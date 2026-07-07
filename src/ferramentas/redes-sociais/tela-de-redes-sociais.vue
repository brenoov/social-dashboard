<template>
  <!-- Porte fiel de .wrapper (dashboard central de Redes Sociais, legacy/index.html
       L2926-3283), VERBATIM, mesmo padrão de Gestão de Tráfego/Gestão à Vista/Análise
       de Campanhas: raiz vira .tela-redes-sociais (sem display:none — quem controla a
       visibilidade agora é o vue-router). Três elementos que no legado são <div>
       irmãos soltos no <body>, FORA de .wrapper (posicionados via position:fixed, então
       o lugar deles na árvore do DOM não muda o layout visual) foram colocados DENTRO
       da raiz deste componente — mesma técnica já usada nos modais da Gestão de
       Tráfego — para que o CSS :deep() (scoped) os alcance: #autocycle-progress
       (legacy L2925), #chart-tooltip (L2635-2649) e #campaign-modal-overlay
       (L11754-11769, o modal "Filtrar campanhas").
       Único onclick trocado por binding Vue: o botão "Central" (Voltar) —
       showHome() vira @click="fecharDashboard" (a função por trás dele agora limpa
       os timers e navega pelo router, em vez de fazer display:none + mostrar a Home
       do monólito). Os demais onclick="..." ficam como STRING literal (igual ao
       legado) — são atributos HTML nativos, avaliados no escopo global; por isso o
       cluster de funções que eles chamam é exposto em window mais abaixo. -->
  <div class="tela-redes-sociais">
    <div id="autocycle-progress"></div>
    <div class="wrapper">

      <!-- TOPBAR — sticky, primeira coisa visível -->
      <div class="topbar">
        <div class="topbar-left">
          <button class="gv-back" @click="fecharDashboard"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>Central</button>
          <img class="rbv-logo rbv-logo-light" :src="logoClaroUrl" alt="RBV">
          <img class="rbv-logo rbv-logo-dark" :src="logoEscuroUrl" alt="RBV">
          <div style="display:flex;flex-direction:column;gap:2px">
            <span class="gv-perf-tag" style="font-size:12px;letter-spacing:4px">Análise de Redes Sociais</span>
            <span class="gv-brand-tag">Inteligência RBV</span>
          </div>
        </div>
        <div class="topbar-center">
          <div class="period-tabs" id="period-tabs"></div>
          <div class="custom-range-inline" id="custom-range-panel">
            <span class="custom-range-lbl">de</span>
            <input type="date" id="custom-start" class="custom-date-input" onchange="onCustomDateChange()" title="Data inicial — clique para abrir o calendário">
            <span class="custom-range-lbl">até</span>
            <input type="date" id="custom-end" class="custom-date-input" onchange="onCustomDateChange()" title="Data final — clique para abrir o calendário">
            <button class="custom-clear-btn" id="custom-clear-btn" onclick="clearCustomRange()" style="display:none" title="Limpar intervalo personalizado">✕</button>
          </div>
          <div class="ac-toggle on" id="ac-toggle-btn" onclick="toggleAutoCycle()" title="Rotação automática de perfis">
            <div class="ac-toggle-track on" id="ac-toggle-track"><div class="ac-toggle-thumb"></div></div>
            <span class="ac-toggle-lbl">AUTO</span>
          </div>
        </div>
        <div class="topbar-right" style="flex-direction:column;align-items:flex-end;gap:2px;">
          <span class="live-dot" style="margin-bottom:2px">Tempo Real</span>
          <div id="dash-clock">--:--:<span>--</span></div>
          <div class="gv-clock-date" id="dash-date"></div>
          <div class="gv-update-status" id="collection-status">—</div>
          <div class="gv-update-status" id="live-status" style="margin-top:1px"></div>
        </div>
      </div>

      <!-- GUARDA DE FRESCOR: avisa quando os dados não são de hoje (coletor parado) -->
      <div id="freshness-banner" style="display:none;align-items:center;gap:8px;padding:9px 16px;background:#7f1d1d;color:#fff;font-family:'IBM Plex Sans',sans-serif;font-size:12px;font-weight:600;letter-spacing:.3px;border-bottom:1px solid #991b1b;"></div>

      <!-- HEADER — seleção de perfil (abaixo da topbar) -->
      <header>
        <div id="header-collapsible">
          <div class="profile-select" id="profile-select"></div>
        </div>
        <button id="header-toggle" onclick="toggleHeader()" title="Ocultar cabeçalho"><span class="ht-arrow">▲</span></button>
      </header>

      <!-- ADMIN PANEL -->
      <div id="admin-panel" style="display:none">
        <div class="admin-title">⚙️ <span>Gerenciar Usuários</span></div>
        <div class="admin-grid">
          <div>
            <div class="admin-section-title">Enviar convite</div>
            <div class="admin-input-row" style="display:flex;flex-direction:column;gap:12px;padding:14px 0;">
              <div>
                <label class="auth-label" for="invite-email">E-mail</label>
                <input type="email" id="invite-email" class="admin-input" placeholder="email@exemplo.com" style="width:100%;box-sizing:border-box;">
              </div>
              <button class="admin-action-btn" id="invite-btn" onclick="doInvite()" style="width:100%;padding:11px;">Enviar convite</button>
            </div>
            <div class="admin-msg" id="invite-msg"></div>
          </div>
          <div>
            <div class="admin-section-title">Usuários cadastrados</div>
            <div class="user-list" id="user-list"><div style="font-family:'DM Sans',sans-serif;font-size:11px;color:var(--muted)">Carregando...</div></div>
          </div>
        </div>
      </div>

      <div id="active-profile-bar">
        <div id="apb-ring-wrap"><img id="apb-img" alt=""></div>
        <div id="apb-dot"></div>
        <span id="apb-name">—</span>
      </div>

      <!-- ANÁLISE INTELIGENTE -->
      <div class="insight-card" id="insight-card">
        <div class="insight-header">
          <span class="insight-icon">◈</span>
          <span class="insight-title">Análise do período</span>
          <span class="insight-period" id="insight-period-label">—</span>
        </div>
        <div class="insight-list" id="insight-list">
          <div class="insight-item muted"><div class="insight-dot muted"></div><span>Carregando...</span></div>
        </div>
        <div class="overall-bar-row">
          <span class="overall-bar-lbl">Meta geral</span>
          <div class="overall-bar-track"><div class="overall-bar-fill" id="overall-bar-fill" style="width:0%"></div></div>
          <span class="overall-bar-pct" id="overall-bar-pct">—</span>
        </div>
      </div>

      <!-- 01 SEGUIDORES -->
      <div class="sec-header">
        <div class="section-label">01 · Seguidores</div>        <div class="sec-line"></div>
      </div>
      <div class="sec1-grid mb40">
        <div class="card" style="padding:0;overflow:hidden;">
          <!-- Hero: total de seguidores -->
          <div id="followers-hero" style="padding:22px 24px 18px;background:var(--accent-light);position:relative;">
            <div class="mc-lbl" style="letter-spacing:2.5px;margin-bottom:10px;">TOTAL DE SEGUIDORES</div>
            <div style="font-family:'Oswald',sans-serif;font-size:54px;font-weight:500;line-height:1;color:var(--accent);letter-spacing:-1px;" id="total-followers">0</div>
          </div>
          <!-- Separador gradiente -->
          <div style="height:2px;background:linear-gradient(to right,var(--accent-mid),var(--border));"></div>
          <!-- Novos no período -->
          <div style="padding:16px 24px 20px;">
            <div class="mc-header" style="margin-bottom:6px;">
              <div class="mc-lbl">NOVOS NO PERÍODO <button onclick="openFollowersInfo()" title="Como esse número é contado?" style="display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;border-radius:50%;border:1px solid currentColor;background:transparent;color:inherit;font-size:10px;font-weight:700;cursor:pointer;line-height:1;padding:0;vertical-align:middle;opacity:.6;">?</button></div>
              <div class="mc-goal-area">
                <span class="mc-goal-lbl">META</span>
                <span class="mc-goal-val" id="goal-followers" contenteditable="true" spellcheck="false">200</span>
                <span class="mc-edit-hint">✏</span>
              </div>
            </div>
            <div class="nf-linhas">
              <div class="nf-linha"><span class="nf-lbl">Seguidores</span><span class="nf-val a-green" id="nf-gained">0</span></div>
              <div class="nf-linha"><span class="nf-lbl">Deixaram de seguir</span><span class="nf-val a-red" id="nf-lost">0</span></div>
              <div class="nf-linha"><span class="nf-lbl">Total</span><span class="nf-val a-blue" id="new-followers-val">0</span></div>
            </div>
            <div class="mc-compare" id="cmp-followers"></div>
            <div id="previa-followers" style="display:none;margin-top:6px;"></div>
            <div class="mc-divider"></div>
            <div class="mc-progress-track"><div class="mc-progress-fill" id="prog-followers" style="width:0%"></div></div>
            <div class="mc-bottom">
              <span class="mc-pct" id="pct-followers">0%</span>
              <span class="mc-diff" id="diff-followers"></span>
            </div>
          </div>
        </div>
        <div class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <div style="font-family:'Oswald',sans-serif;font-weight:400;font-size:11px;letter-spacing:1.5px;color:var(--muted)">NOVOS SEGUIDORES / DIA</div>
            <div class="chart-legend">
              <div class="legend-item"><div class="legend-dot" style="background:#16a34a"></div><span>Seguiram</span></div>
              <div class="legend-item"><div class="legend-dot" style="background:#dc2626"></div><span>Deixaram</span></div>
              <div class="legend-item"><span style="font-weight:700;color:var(--text)">n</span><span>= líquido</span></div>
            </div>
          </div>
          <div class="chart-svg-wrap">
            <svg id="followers-chart" viewBox="0 0 400 110" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#1D4ED8" stop-opacity="0.25"/>
                  <stop offset="100%" stop-color="#1D4ED8" stop-opacity="0"/>
                </linearGradient>
              </defs>
              <path id="chart-fill" fill="url(#chartGrad)"/>
              <line id="chart-zero" x1="0" y1="0" x2="400" y2="0" stroke="currentColor" stroke-width="0.6" opacity="0.25"/>
              <g id="chart-bars"></g>
              <polyline id="prev-line" fill="none" stroke="rgba(0,0,0,0.15)" stroke-width="1.5" stroke-dasharray="4,3" stroke-linecap="round"/>
              <polyline id="chart-line" fill="none" stroke="#1D4ED8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <line id="crosshair" x1="0" y1="0" x2="0" y2="110" stroke="rgba(0,0,0,0.15)" stroke-width="1" display="none"/>
              <circle id="dot-curr" r="4" fill="#1D4ED8" stroke="#f4f5fa" stroke-width="2" display="none"/>
              <circle id="dot-prev" r="3.5" fill="rgba(0,0,0,0.2)" stroke="#f4f5fa" stroke-width="2" display="none"/>
              <rect id="chart-overlay" x="0" y="0" width="400" height="110" fill="transparent"/>
            </svg>
            <div id="chart-data-labels"></div>
          </div>
          <div class="x-labels" id="chart-xlabels"></div>
        </div>
      </div>

      <!-- 02 META ADS -->
      <div class="sec-header">
        <div class="section-label">02 · Meta Ads</div>        <div class="sec-line"></div>
      </div>
      <div class="camp-filter-bar">
        <span class="camp-filter-lbl">Campanhas consideradas no cálculo:</span>
        <span class="camp-filter-info" id="camp-filter-info">Todas as campanhas</span>
        <button class="btn-campaign-filter" id="btn-campaign-filter" onclick="openCampaignModal()">⚙ Filtrar campanhas</button>
      </div>
      <div class="sec2-grid mb40">
        <div class="card">
          <div class="mc-header">
            <div class="mc-icon">💰</div>
            <div class="mc-goal-area">
              <span class="mc-goal-lbl">BUDGET</span>
              <span class="mc-goal-val" id="goal-spend" contenteditable="true" spellcheck="false">600</span>
              <span class="mc-edit-hint">✏</span>
            </div>
          </div>
          <div class="mc-lbl">INVESTIMENTO NO PERÍODO</div>
          <div class="mc-val a-purple" id="ads-spend-val">R$ 0</div>
          <div class="mc-compare" id="cmp-spend"></div>
          <div class="mc-divider"></div>
          <div class="mc-progress-track"><div class="mc-progress-fill" id="prog-spend" style="width:0%"></div></div>
          <div class="mc-bottom">
            <span class="mc-pct" id="pct-spend">0%</span>
            <span class="mc-diff" id="diff-spend"></span>
          </div>
          <div class="calc-badge">⚡ Menor gasto com mais resultado = ideal</div>
        </div>
        <div class="card">
          <div class="mc-header">
            <div class="mc-icon">🎯</div>
            <div class="mc-goal-area">
              <span class="mc-goal-lbl">META MÁX</span>
              <span class="mc-goal-val" id="goal-cps" contenteditable="true" spellcheck="false">2.00</span>
              <span class="mc-edit-hint">✏</span>
            </div>
          </div>
          <div class="mc-lbl">CUSTO POR SEGUIDOR</div>
          <div class="mc-val a-blue" id="ads-cps-val">R$ 0</div>
          <div class="mc-compare" id="cmp-cps"></div>
          <div class="mc-divider"></div>
          <div class="mc-progress-track"><div class="mc-progress-fill" id="prog-cps" style="width:0%"></div></div>
          <div class="mc-bottom">
            <span class="mc-pct" id="pct-cps">0%</span>
            <span class="mc-diff" id="diff-cps"></span>
          </div>
          <div class="calc-badge">⚡ Menor é melhor · investimento ÷ novos seguidores</div>
        </div>
        <div class="card">
          <div class="mc-header">
            <div class="mc-icon">🤝</div>
            <div class="mc-goal-area">
              <span class="mc-goal-lbl">META MÁX</span>
              <span class="mc-goal-val" id="goal-cpi" contenteditable="true" spellcheck="false">0.15</span>
              <span class="mc-edit-hint">✏</span>
            </div>
          </div>
          <div class="mc-lbl">CUSTO POR INTERAÇÃO</div>
          <div class="mc-val a-purple" id="ads-cpi-val">R$ —</div>
          <div class="mc-compare" id="cmp-cpi"></div>
          <div class="mc-divider"></div>
          <div class="mc-progress-track"><div class="mc-progress-fill" id="prog-cpi" style="width:0%"></div></div>
          <div class="mc-bottom">
            <span class="mc-pct" id="pct-cpi">0%</span>
            <span class="mc-diff" id="diff-cpi"></span>
          </div>
          <div class="calc-badge">⚡ Menor é melhor · investimento ÷ interações do anúncio</div>
        </div>
        <div class="card">
          <div class="mc-header">
            <div class="mc-icon">❤️</div>
            <div class="mc-goal-area">
              <span class="mc-goal-lbl">META MÁX</span>
              <span class="mc-goal-val" id="goal-cpl" contenteditable="true" spellcheck="false">0.20</span>
              <span class="mc-edit-hint">✏</span>
            </div>
          </div>
          <div class="mc-lbl">CUSTO POR CURTIDA</div>
          <div class="mc-val a-blue" id="ads-cpl-val">R$ —</div>
          <div class="mc-compare" id="cmp-cpl"></div>
          <div class="mc-divider"></div>
          <div class="mc-progress-track"><div class="mc-progress-fill" id="prog-cpl" style="width:0%"></div></div>
          <div class="mc-bottom">
            <span class="mc-pct" id="pct-cpl">0%</span>
            <span class="mc-diff" id="diff-cpl"></span>
          </div>
          <div class="calc-badge">⚡ Menor é melhor · investimento ÷ curtidas do anúncio</div>
        </div>
      </div>
      <div class="mc-lbl" style="margin:0 0 8px;">EFICIÊNCIA DO INVESTIMENTO</div>

      <!-- 03 ENGAJAMENTO -->
      <div class="sec-header">
        <div class="section-label">03 · Engajamento</div>        <div class="sec-line"></div>
      </div>
      <div class="eng-tabs" id="eng-tabs">
        <button class="eng-tab active" data-tab="geral" onclick="setEngTab('geral')">Geral</button>
        <button class="eng-tab" data-tab="reel" onclick="setEngTab('reel')">Reels</button>
        <button class="eng-tab" data-tab="post" onclick="setEngTab('post')">Posts</button>
        <button class="eng-tab" data-tab="story" onclick="setEngTab('story')">Stories</button>
        <button class="eng-tab" data-tab="ad" onclick="setEngTab('ad')">Anúncios</button>
      </div>
      <div class="sec3-grid mb40">
        <div class="card" style="animation-delay:.05s">
          <div class="mc-header"><div class="mc-icon">❤️</div><div class="mc-goal-area"><span class="mc-goal-lbl">META</span><span class="mc-goal-val" id="goal-likes" contenteditable="true" spellcheck="false">1000</span><span class="mc-edit-hint">✏</span></div></div>
          <div class="mc-lbl">CURTIDAS</div>
          <div class="mc-val a-orange" id="eng-likes">0</div>
          <div class="mc-ad-sub" id="eng-likes-ad"></div>
          <div class="mc-compare" id="cmp-likes"></div>
          <div class="mc-divider"></div>
          <div class="mc-progress-track"><div class="mc-progress-fill" id="prog-likes" style="width:0%"></div></div>
          <div class="mc-bottom"><span class="mc-pct" id="pct-likes">0%</span><span class="mc-diff" id="diff-likes"></span></div>
        </div>
        <div class="card" style="animation-delay:.075s">
          <div class="mc-header"><div class="mc-icon">💬</div><div class="mc-goal-area"><span class="mc-goal-lbl">META</span><span class="mc-goal-val" id="goal-comments" contenteditable="true" spellcheck="false">120</span><span class="mc-edit-hint">✏</span></div></div>
          <div class="mc-lbl">COMENTÁRIOS</div>
          <div class="mc-val a-blue" id="eng-comments">0</div>
          <div class="mc-ad-sub" id="eng-comments-ad"></div>
          <div class="mc-compare" id="cmp-comments"></div>
          <div class="mc-divider"></div>
          <div class="mc-progress-track"><div class="mc-progress-fill" id="prog-comments" style="width:0%"></div></div>
          <div class="mc-bottom"><span class="mc-pct" id="pct-comments">0%</span><span class="mc-diff" id="diff-comments"></span></div>
        </div>
        <div class="card" style="animation-delay:.10s">
          <div class="mc-header"><div class="mc-icon">🔖</div><div class="mc-goal-area"><span class="mc-goal-lbl">META</span><span class="mc-goal-val" id="goal-saves" contenteditable="true" spellcheck="false">250</span><span class="mc-edit-hint">✏</span></div></div>
          <div class="mc-lbl">SALVAMENTOS</div>
          <div class="mc-val a-pink" id="eng-saves">0</div>
          <div class="mc-ad-sub" id="eng-saves-ad"></div>
          <div class="mc-compare" id="cmp-saves"></div>
          <div class="mc-divider"></div>
          <div class="mc-progress-track"><div class="mc-progress-fill" id="prog-saves" style="width:0%"></div></div>
          <div class="mc-bottom"><span class="mc-pct" id="pct-saves">0%</span><span class="mc-diff" id="diff-saves"></span></div>
        </div>
        <div class="card" style="animation-delay:.15s">
          <div class="mc-header"><div class="mc-icon">↗️</div><div class="mc-goal-area"><span class="mc-goal-lbl">META</span><span class="mc-goal-val" id="goal-shares" contenteditable="true" spellcheck="false">200</span><span class="mc-edit-hint">✏</span></div></div>
          <div class="mc-lbl">COMPARTILHAMENTOS</div>
          <div class="mc-val a-purple" id="eng-shares">0</div>
          <div class="mc-ad-sub" id="eng-shares-ad"></div>
          <div class="mc-compare" id="cmp-shares"></div>
          <div class="mc-divider"></div>
          <div class="mc-progress-track"><div class="mc-progress-fill" id="prog-shares" style="width:0%"></div></div>
          <div class="mc-bottom"><span class="mc-pct" id="pct-shares">0%</span><span class="mc-diff" id="diff-shares"></span></div>
        </div>
        <div class="card"><div class="mc-header"><div class="mc-icon">👁</div><div class="mc-goal-area"><span class="mc-goal-lbl">META</span><span class="mc-goal-val" id="goal-reach" contenteditable="true" spellcheck="false">30000</span><span class="mc-edit-hint">✏</span></div></div><div class="mc-lbl">ALCANCE</div><div class="mc-val a-blue" id="eng-reach">0</div><div class="mc-compare" id="cmp-reach"></div><div class="mc-divider"></div><div class="mc-progress-track"><div class="mc-progress-fill" id="prog-reach" style="width:0%"></div></div><div class="mc-bottom"><span class="mc-pct" id="pct-reach">0%</span><span class="mc-diff" id="diff-reach"></span></div></div>
        <div class="card"><div class="mc-header"><div class="mc-icon">▶️</div><div class="mc-goal-area"><span class="mc-goal-lbl">META</span><span class="mc-goal-val" id="goal-views" contenteditable="true" spellcheck="false">50000</span><span class="mc-edit-hint">✏</span></div></div><div class="mc-lbl">VISUALIZAÇÕES</div><div class="mc-val a-orange" id="eng-views">0</div><div class="mc-compare" id="cmp-views"></div><div class="mc-divider"></div><div class="mc-progress-track"><div class="mc-progress-fill" id="prog-views" style="width:0%"></div></div><div class="mc-bottom"><span class="mc-pct" id="pct-views">0%</span><span class="mc-diff" id="diff-views"></span></div></div>
        <div class="card"><div class="mc-header"><div class="mc-icon">🤝</div><div class="mc-goal-area"><span class="mc-goal-lbl">META</span><span class="mc-goal-val" id="goal-interactions" contenteditable="true" spellcheck="false">3000</span><span class="mc-edit-hint">✏</span></div></div><div class="mc-lbl">INTERAÇÕES TOTAIS</div><div class="mc-val a-pink" id="eng-interactions">0</div><div class="mc-compare" id="cmp-interactions"></div><div class="mc-divider"></div><div class="mc-progress-track"><div class="mc-progress-fill" id="prog-interactions" style="width:0%"></div></div><div class="mc-bottom"><span class="mc-pct" id="pct-interactions">0%</span><span class="mc-diff" id="diff-interactions"></span></div></div>
        <div class="card"><div class="mc-header"><div class="mc-icon">👤</div><div class="mc-goal-area"><span class="mc-goal-lbl">META</span><span class="mc-goal-val" id="goal-profile-views" contenteditable="true" spellcheck="false">3000</span><span class="mc-edit-hint">✏</span></div></div><div class="mc-lbl">VISITAS AO PERFIL</div><div class="mc-val a-blue" id="eng-profile-views">0</div><div class="mc-compare" id="cmp-profile-views"></div><div class="mc-divider"></div><div class="mc-progress-track"><div class="mc-progress-fill" id="prog-profile-views" style="width:0%"></div></div><div class="mc-bottom"><span class="mc-pct" id="pct-profile-views">0%</span><span class="mc-diff" id="diff-profile-views"></span></div></div>
      </div>

      <!-- 04 CONTEÚDO -->
      <div class="sec-header">
        <div class="section-label">04 · Conteúdo</div>        <div class="sec-line"></div>
      </div>
      <div class="sec4-grid">
        <div class="card" style="animation-delay:.05s">
          <div class="mc-header"><div class="mc-icon">⭕</div><div class="mc-goal-area"><span class="mc-goal-lbl">META</span><span class="mc-goal-val" id="goal-stories" contenteditable="true" spellcheck="false">28</span><span class="mc-edit-hint">✏</span></div></div>
          <div class="mc-lbl">STORIES</div>
          <div class="mc-val a-pink" id="cnt-stories">0</div>
          <div class="mc-compare" id="cmp-stories"></div>
          <div class="mc-divider"></div>
          <div class="mc-progress-track"><div class="mc-progress-fill" id="prog-stories" style="width:0%"></div></div>
          <div class="mc-bottom"><span class="mc-pct" id="pct-stories">0%</span><span class="mc-diff" id="diff-stories"></span></div>
        </div>
        <div class="card" style="animation-delay:.10s">
          <div class="mc-header"><div class="mc-icon">🎬</div><div class="mc-goal-area"><span class="mc-goal-lbl">META</span><span class="mc-goal-val" id="goal-posts-reels" contenteditable="true" spellcheck="false">12</span><span class="mc-edit-hint">✏</span></div></div>
          <div class="mc-lbl">POSTS &amp; REELS</div>
          <div class="mc-val a-purple" id="cnt-posts-reels">0</div>
          <div class="mc-obs">ⓘ A API da Meta não contabiliza collabs (posts em parceria contam pra conta dona).</div>
          <div class="mc-compare" id="cmp-posts-reels"></div>
          <div class="mc-divider"></div>
          <div class="mc-progress-track"><div class="mc-progress-fill" id="prog-posts-reels" style="width:0%"></div></div>
          <div class="mc-bottom"><span class="mc-pct" id="pct-posts-reels">0%</span><span class="mc-diff" id="diff-posts-reels"></span></div>
        </div>
      </div>
    </div><!-- /wrapper -->

    <!-- FLOATING TOOLTIP (legacy L2635-2649 — irmão solto no body; posicionado aqui
         dentro da raiz do componente só para o :deep() alcançar; position:fixed não
         muda o layout visual) -->
    <div id="chart-tooltip">
      <div class="tt-date" id="tt-date"></div>
      <div class="tt-row">
        <div class="tt-dot curr"></div>
        <div class="tt-label" id="tt-curr-label">Este período</div>
        <div class="tt-val" id="tt-curr-val"></div>
      </div>
      <div class="tt-row">
        <div class="tt-dot prev"></div>
        <div class="tt-label" id="tt-prev-label">Mês anterior</div>
        <div class="tt-val" id="tt-prev-val" style="color:var(--muted)"></div>
      </div>
      <div class="tt-sep"></div>
      <div class="tt-delta" id="tt-delta"></div>
    </div>

    <!-- MODAL "Filtrar campanhas" (legacy L11754-11769 — mesmo motivo do tooltip
         acima: irmão solto no body no legado, trazido pra dentro da raiz aqui) -->
    <div id="campaign-modal-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:2000;align-items:center;justify-content:center;backdrop-filter:blur(4px);" onclick="if(event.target===this)this.style.display='none'">
      <div class="campaign-modal">
        <div class="camp-modal-hdr">
          <span>Filtro de Campanhas</span>
          <button class="camp-modal-close" onclick="document.getElementById('campaign-modal-overlay').style.display='none'">✕</button>
        </div>
        <div class="camp-modal-sub">Selecione as campanhas contabilizadas nos indicadores de Ads. <strong id="camp-count"></strong></div>
        <div id="campaign-list" class="camp-list"></div>
        <div class="camp-modal-footer">
          <button class="btn-camp-all" onclick="document.querySelectorAll('#campaign-list input').forEach(cb=>cb.checked=true);updateCampaignCount()">Selecionar todas</button>
          <button class="btn-camp-all" onclick="document.querySelectorAll('#campaign-list input').forEach(cb=>cb.checked=false);updateCampaignCount()">Desmarcar todas</button>
          <button class="btn-camp-none" onclick="saveNoneCampaigns()">Nenhuma</button>
          <button class="btn-camp-save" onclick="saveCampaignFilter()">Salvar filtro</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { sbClient, SUPABASE_URL, SUPABASE_ANON_KEY } from '../../compartilhado/conectar-no-banco-de-dados.js'
import { estado, hasPermission } from '../../compartilhado/controle-de-login-e-usuario.js'
import { adminToast } from '../../compartilhado/avisos.js'
import { sb } from '../../compartilhado/buscar-e-salvar-dados.js'

const router = useRouter()

const logoClaroUrl = '/midia/LOGOTIPOBRENOPRETO.png'
const logoEscuroUrl = '/midia/LOGOTIPOBRENOBRANCO.png'

// ==========================================================================
// PORTE VERBATIM do Dashboard Redes Sociais (legacy/index.html — funções e
// estado espalhados entre L3286-5725), menos openDashboard/showDashboard/
// loadDashboard (que setavam currentUserRole/Features/currentSession e
// mostravam/escondiam "telas" do monólito por display:none) — essas 3 já
// estão cobertas pela fundação de login compartilhada (controle-de-login-e-
// usuario.js: estado.role/features/userId/currentSession) e pelo vue-router
// (visibilidade da tela). Em vez delas, onMounted abaixo roda diretamente o
// PIPELINE de inicialização que loadDashboard chamava depois de já ter o
// papel/features (ver comentário no onMounted).
//
// Dependências externas resolvidas:
//   - sbClient, SUPABASE_URL, SUPABASE_ANON_KEY → import (conectar-no-banco-de-dados.js)
//   - hasPermission                              → import (controle-de-login-e-usuario.js)
//     (a checagem por dentro dela é idêntica à hasPermission local do legado
//     (legacy L3291-3298) — mesmo keyMap, incluindo 'tool:social' — por isso
//     NÃO foi copiada de novo aqui, só importada.)
//   - adminToast                                 → import (avisos.js)
//   - sb                                         → import (buscar-e-salvar-dados.js) —
//     idêntico ao sb() do legado (legacy L3356), só troca currentSession por
//     estado.currentSession; reaproveitado em vez de copiado de novo.
//   - estado.currentSession                      → substitui a global solta `currentSession`
//     do legado (usada em saveNoneCampaigns/saveCampaignFilter).
//   - estado.role/estado.features/estado.userId  → substituem
//     currentUserRole/currentUserFeatures/currentUserId (não usados diretamente
//     neste módulo — só via hasPermission importado).
//
// Coisas que no legado rodavam SOLTAS no escopo global do <script> (fora de
// qualquer função, executadas uma vez ao carregar a página) e que aqui viraram
// parte do onMounted/onUnmounted (senão os elementos do DOM ainda não existem
// quando o módulo é avaliado, e os listeners vazariam entre montagens da rota):
//   - a wiring do tooltip do gráfico (svgEl/overlay/crosshair/dotCurr/dotPrev/
//     tooltip + addEventListener mousemove/mouseleave no #chart-overlay,
//     legacy L3599-3629);
//   - os 4 document.addEventListener(mousemove/click/keydown/touchstart,
//     _acResetInactivity) do auto-cycle (legacy L4302-4306).
// Ambos são registrados em onMounted e removidos em onUnmounted.
//
// Outra pequena adaptação (fora do "verbatim" estrito, mas exigida pra não
// vazar timers entre entradas/saídas da rota — CLAUDE.md gotcha #4): o
// startClock() do legado (L5222) nunca guardava o id do seu próprio
// setInterval (um "bug" inofensivo no monólito, que só carregava a página
// uma vez). Aqui ele guarda em _clockTimer, limpo em onUnmounted.
//
// Nada foi reescrito para template reativo — o board inteiro (metric cards,
// gráfico SVG, chips, seletor de perfis, modal de campanhas, painel admin)
// segue montado via getElementById/createElement/innerHTML, exatamente como
// a produção atual. Por isso o cluster de funções chamadas por onclick="..."
// literal no <template> acima é exposto em window no fim deste bloco.
// ==========================================================================

/* ── PERÍODOS / TEMAS DE PERFIL (legacy L3300-3321, verbatim) ── */
// "Hoje" removido; "MÊS" (mês corrente) unifica o antigo MÊS + ATÉ AGORA (eram a mesma coisa).
// 2D (não 1D): o follows de ONTEM ainda não consolidou na Meta (~2 dias); 2D já pega um dia consolidado.
const PERIODS = [{ label: '2D', value: 2 }, { label: '7D', value: 7 }, { label: '14D', value: 14 }, { label: '30D', value: 30 }, { label: 'MÊS', value: 'monthfull' }, { label: 'MÊS PASS.', value: 'lastmonth' }]
const ACCOUNT_PICS = {}
const PROFILE_THEMES = {
  'Raíssa Herculano': { accent: '#BE185D', light: 'rgba(190,24,93,0.08)', mid: 'rgba(190,24,93,0.30)' },
  'Breno Vale': { accent: '#1D4ED8', light: 'rgba(29,78,216,0.08)', mid: 'rgba(29,78,216,0.30)' },
  'Mantova Móveis': { accent: '#1D4ED8', light: 'rgba(29,78,216,0.08)', mid: 'rgba(29,78,216,0.30)' },
  'Vessel': { accent: '#166534', light: 'rgba(22,101,52,0.08)', mid: 'rgba(22,101,52,0.30)' },
  'Motoeasy': { accent: '#9B1C1C', light: 'rgba(155,28,28,0.08)', mid: 'rgba(155,28,28,0.30)' },
}
function applyProfileTheme(name) {
  // Cor de destaque FIXA — NÃO muda por perfil (nem no modo vitrine, nem no clique manual).
  // Usa o accent do tema atual (respeita claro/escuro); não sobrescreve --accent por perfil.
  const acc = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#1D4ED8'
  const line = document.getElementById('chart-line'); if (line) line.setAttribute('stroke', acc)
  const dot = document.getElementById('dot-curr'); if (dot) dot.setAttribute('fill', acc)
  document.querySelectorAll('#chartGrad stop').forEach(s => s.setAttribute('stop-color', acc))
  const ll = document.getElementById('chart-legend-line'); if (ll) ll.style.background = acc
  const apbName = document.getElementById('apb-name'); if (apbName) apbName.textContent = name
  const apbImg = document.getElementById('apb-img')
  const apbRingWrap2 = document.getElementById('apb-ring-wrap')
  if (apbImg) { const pic = ACCOUNT_PICS[name]; if (pic) { apbImg.src = pic; if (apbRingWrap2) apbRingWrap2.style.display = 'flex' } else { if (apbRingWrap2) apbRingWrap2.style.display = 'none' } }
}

/* ── METAS PADRÃO (legacy L3323-3346, verbatim) ── */
const GOALS = {
  followers: { 1: 60, 7: 200, 14: 400, 30: 1500 },
  spend: { 1: 100, 7: 600, 14: 1200, 30: 2500 },
  cps: { 1: 2.0, 7: 2.0, 14: 2.0, 30: 2.0 },
  cpi: { 1: 0.15, 7: 0.15, 14: 0.15, 30: 0.15 },
  cpl: { 1: 0.20, 7: 0.20, 14: 0.20, 30: 0.20 },
  likes: { 1: 400, 7: 1000, 14: 2000, 30: 12000 },
  saves: { 1: 80, 7: 250, 14: 500, 30: 2500 },
  shares: { 1: 60, 7: 200, 14: 400, 30: 2000 },
  stories: { 1: 6, 7: 28, 14: 56, 30: 120 },
  'posts-reels': { 1: 3, 7: 12, 14: 24, 30: 50 },
  'story-shares': { 1: 30, 7: 200, 14: 400, 30: 900 },
  'story-replies': { 1: 8, 7: 50, 14: 100, 30: 220 },
  reach: { 1: 5000, 7: 30000, 14: 60000, 30: 120000 },
  views: { 1: 8000, 7: 50000, 14: 100000, 30: 200000 },
  interactions: { 1: 500, 7: 3000, 14: 6000, 30: 12000 },
  engaged: { 1: 400, 7: 2500, 14: 5000, 30: 10000 },
  'profile-views': { 1: 500, 7: 3000, 14: 6000, 30: 12000 },
  'st-reach': { 1: 500, 7: 3000, 14: 6000, 30: 12000 },
  'st-interactions': { 1: 30, 7: 150, 14: 300, 30: 600 },
  'st-navigation': { 1: 200, 7: 1200, 14: 2400, 30: 5000 },
  'st-profile-visits': { 1: 10, 7: 60, 14: 120, 30: 250 },
  'st-follows': { 1: 2, 7: 12, 14: 24, 30: 50 },
}

/* ── ESTADO DO MÓDULO (legacy L3348-3353, verbatim exceto currentSession,
   que virou estado.currentSession — importado) ── */
let currentPeriod = (function () { try { const raw = localStorage.getItem('dash_period'); if (raw == null) return 7; const m = PERIODS.find(p => String(p.value) === raw); return m ? m.value : 7 } catch (e) { return 7 } })()
let currentAccountId = null
let currentStartDate = null
let currentEndDate = null
let activeChartData = null

/* ── HELPERS (legacy L3367-3411, verbatim) ── */
function popEl(el) {
  const tgt = el.closest ? el.closest('.mc-val') || el : el
  tgt.style.animation = 'none'; void tgt.offsetWidth
  tgt.style.animation = 'numPop .4s cubic-bezier(.34,1.56,.64,1)'
}
function animCount(el, target) {
  const dur = 800, start = performance.now()
  // Tooltip universal: guarda o número INTEIRO (fmtN resume no texto) p/ revelar no hover/toque.
  const cheio = (Number(target) || 0).toLocaleString('pt-BR')
  try { el.title = cheio; el.dataset.full = cheio; el.classList.add('tem-tooltip') } catch (e) {}
  function tick(now) {
    const t = Math.min((now - start) / dur, 1)
    const v = Math.round(target * (1 - Math.pow(1 - t, 3)))
    el.textContent = fmtN(v)
    if (t < 1) requestAnimationFrame(tick); else popEl(el)
  }
  requestAnimationFrame(tick)
}
// Toque/clique num número resumido revela o inteiro (mobile); no desktop o :hover já mostra.
function _onTooltipTap(e) {
  const alvo = e.target.closest ? e.target.closest('.tem-tooltip') : null
  document.querySelectorAll('.tela-redes-sociais .tem-tooltip.mostrar').forEach(el => { if (el !== alvo) el.classList.remove('mostrar') })
  if (alvo) alvo.classList.toggle('mostrar')
}
function animCountFull(el, target) {
  const dur = 900, start = performance.now()
  function tick(now) {
    const t = Math.min((now - start) / dur, 1)
    const v = Math.round(target * (1 - Math.pow(1 - t, 3)))
    el.textContent = v.toLocaleString('pt-BR')
    if (t < 1) requestAnimationFrame(tick); else popEl(el)
  }
  requestAnimationFrame(tick)
}
function fmtN(n) { n = Number(n) || 0; const a = Math.abs(n); if (a >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + ' mi'; if (a >= 1e3) return (n / 1e3).toFixed(1).replace('.', ',') + ' mil'; return String(n) }
function fmtR(v) { const p = v.toFixed(2).split('.'); return 'R$ ' + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + p[1] }
function pctDiff(curr, prev) { if (!prev) return '+0.0%'; const d = ((curr - prev) / prev * 100); return (d >= 0 ? '+' : '') + d.toFixed(1) + '%' }
function perfColor(pct) { return pct >= 100 ? 'green' : pct >= 75 ? 'yellow' : pct >= 50 ? 'orange' : 'red' }
// formatação condicional: pinta o NÚMERO do indicador conforme o desempenho vs meta
const _PERF_VAR = { green: 'var(--green)', yellow: 'var(--yellow)', orange: 'var(--orange)', red: 'var(--red)' }
function _mcValColor(key, clr) { const pe = document.getElementById('pct-' + key); const card = pe && pe.closest('.card'); const v = card && card.querySelector('.mc-val'); if (!v) return; const col = _PERF_VAR[clr] || ''; if (col) { v.style.setProperty('color', col, 'important'); v.style.setProperty('-webkit-text-fill-color', col, 'important') } else { v.style.removeProperty('color'); v.style.removeProperty('-webkit-text-fill-color') } }
function _mcBorderColor(key, clr) { const pe = document.getElementById('pct-' + key); const card = pe && pe.closest('.card'); if (!card) return; card.style.borderLeftColor = clr ? (_PERF_VAR[clr] || '') : '' }
function goalStorageKey(key, period, accountId) { return 'ig_goal_' + (accountId || 'default') + '_' + period + '_' + key }
const RATE_GOALS = ['cps', 'cpi', 'cpl']
// comprimento em dias de cada período (pro recálculo proporcional). null = comprimento variável (não escala).
function periodDays(period) {
  if (period === 0 || period === 1) return 1
  if (period === 7 || period === 14 || period === 30) return period
  const now = new Date()
  if (period === 'monthfull') return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  if (period === 'lastmonth') return new Date(now.getFullYear(), now.getMonth(), 0).getDate()
  if (period === 'sofar') return null
  const n = Number(period); return (isFinite(n) && n > 0) ? n : 7
}
// Janelas EXATAS por período (fuso BRT) para a busca AO VIVO dos KPIs (ver docs/superpowers/.../redes-hibrido).
// Engajamento = faixa do período (mês-calendário no lastmonth/monthfull). Follows = a MESMA janela deslocada -1 dia
// (a Meta bucketiza follows_and_unfollows 1 dia atrás — validado: mês passado follows = 31/05→30/06 = 1281/571).
function janelasDoPeriodo(period, hoje = new Date(), customStart = null, customEnd = null) {
  const TS = (d) => String(Math.floor(d.getTime() / 1000))
  const dia00 = (yy, mm1, dd) => new Date(`${yy}-${String(mm1).padStart(2, '0')}-${String(dd).padStart(2, '0')}T00:00:00-03:00`)
  const menos1 = (d) => new Date(d.getTime() - 86400000)
  const menosDias = (d, n) => new Date(d.getTime() - n * 86400000)
  const primeiro = (yy, mIdx) => { const d = new Date(yy, mIdx, 1); return dia00(d.getFullYear(), d.getMonth() + 1, 1) }
  const y = hoje.getFullYear(), M = hoje.getMonth()
  const hoje00 = dia00(y, M + 1, hoje.getDate())
  // engS/engU = janela ATUAL; engSp/engUp = janela do período ANTERIOR (pro comparativo).
  // folShift = aplica o -1 dia nos follows? Só o MÊS PASSADO (fechado) precisa (validado 1281/571).
  // Rolantes/mês corrente/personalizado usam a janela DIRETA (validado: 7D 30/06-06/07 = 319/130 exato).
  let engS, engU, engSp, engUp, folShift = false
  if (customStart && customEnd) {
    // Intervalo personalizado (faixa fechada): eng = [início 00:00, fim+1dia 00:00); anterior = mesma duração logo antes.
    engS = new Date(`${customStart}T00:00:00-03:00`)
    engU = new Date(new Date(`${customEnd}T00:00:00-03:00`).getTime() + 86400000)
    const dias = Math.round((engU.getTime() - engS.getTime()) / 86400000)
    engSp = menosDias(engS, dias); engUp = engS
  } else if (period === 'lastmonth') {
    engS = primeiro(y, M - 1); engU = primeiro(y, M)
    engSp = primeiro(y, M - 2); engUp = primeiro(y, M - 1)
    folShift = true // mês passado fechado usa o -1 dia
  } else if (period === 'monthfull' || period === 'sofar' || period === 'month') {
    // MÊS = mês corrente ATÉ ONTEM (dias completos); comparativo = MESMO nº de dias no mês anterior.
    engS = primeiro(y, M); engU = hoje00
    const dias = Math.round((engU.getTime() - engS.getTime()) / 86400000)
    engSp = primeiro(y, M - 1); engUp = new Date(engSp.getTime() + dias * 86400000)
  } else if (period === 1) {
    engU = hoje00; engS = menos1(hoje00); engUp = engS; engSp = menos1(engS)
  } else {
    // Rolantes (7/14/30): janela DIRETA [hoje-N, hoje) — inclui ONTEM, SEM -1 dia (validado: 7D=319/130, 14D=638/262, 30D=1295/580).
    const n = Number(period) || 30
    engU = hoje00; engS = menosDias(hoje00, n); engUp = engS; engSp = menosDias(engS, n)
  }
  const w = (s, u) => ({ eS: TS(s), eU: TS(u), fS: TS(folShift ? menos1(s) : s), fU: TS(folShift ? menos1(u) : u) })
  const c = w(engS, engU), p = w(engSp, engUp)
  return {
    engSince: c.eS, engUntil: c.eU, folSince: c.fS, folUntil: c.fU,
    prevEngSince: p.eS, prevEngUntil: p.eU, prevFolSince: p.fS, prevFolUntil: p.fU, folShift,
  }
}
// KPIs AO VIVO (exatos da Meta) via edge function insights-ao-vivo. Token fica no servidor.
// Cache leve por (conta+período) por 3min; null se a Meta falhar (a tela cai no coletado).
const _kpiCache = {}
async function buscarKpisAoVivo(accountId, period, customStart, customEnd) {
  const chave = accountId + '|' + String(period) + '|' + (customStart || '') + '|' + (customEnd || '')
  const agora = Date.now()
  if (_kpiCache[chave] && (agora - _kpiCache[chave].t) < 180000) return _kpiCache[chave].v
  try {
    const jan = janelasDoPeriodo(period, new Date(), customStart, customEnd)
    const { data, error } = await sbClient.functions.invoke('insights-ao-vivo', { body: { account_id: accountId, ...jan } })
    if (error || !data || data.meta_erro || data.followers_count == null) return null
    _kpiCache[chave] = { t: agora, v: data }
    return data
  } catch (e) { return null }
}
// Série DIÁRIA exata de novos seguidores (para o gráfico bater com o painel). Cada dia = follows numa janela
// de 1 dia deslocada -1 dia (mesmo offset do agregado). Batch via edge serie-novos-dia. Cache 3min.
const _serieCache = {}
async function buscarSerieNovos(accountId, period, customStart, customEnd) {
  const chave = accountId + '|serie|' + String(period) + '|' + (customStart || '') + '|' + (customEnd || '')
  const agora = Date.now()
  if (_serieCache[chave] && (agora - _serieCache[chave].t) < 180000) return _serieCache[chave].v
  try {
    const jan = janelasDoPeriodo(period, new Date(), customStart, customEnd)
    const DIA = 86400, dias = []
    for (let d = Number(jan.engSince); d < Number(jan.engUntil); d += DIA) {
      const iso = new Date(d * 1000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
      // follows do dia = janela do dia; deslocada -1 só quando o período usa folShift (mês passado).
      dias.push({ label: iso, since: jan.folShift ? (d - DIA) : d, until: jan.folShift ? d : (d + DIA) })
    }
    if (!dias.length || dias.length > 93) return null // janela vazia ou muito longa → mantém coletado
    const { data, error } = await sbClient.functions.invoke('serie-novos-dia', { body: { account_id: accountId, dias } })
    if (error || !data || !Array.isArray(data.serie) || !data.serie.length) return null
    _serieCache[chave] = { t: agora, v: data.serie }
    return data.serie
  } catch (e) { return null }
}
// salva a meta no período editado, RECALCULA proporcional em todos os outros intervalos,
// grava no localStorage (instantâneo) E no Supabase (compartilhado entre usuários).
function saveGoal(key, val) {
  const num = parseFloat(String(val).replace(',', '.')); if (isNaN(num)) return
  const anchor = currentPeriod === 0 ? 1 : currentPeriod
  const rows = [[anchor, num]]
  if (RATE_GOALS.includes(key)) { // taxa (ex.: custo por seguidor) — mesmo valor em todo período
    PERIODS.forEach(P => { const p = P.value === 0 ? 1 : P.value; if (p !== anchor) rows.push([p, num]) })
  } else {
    const aDays = periodDays(anchor)
    if (aDays) PERIODS.forEach(P => { const p = P.value === 0 ? 1 : P.value; if (p === anchor) return; const d = periodDays(p); if (!d) return; rows.push([p, Math.max(1, Math.round(num * d / aDays))]) }) // 'sofar' mantém meta própria
  }
  const seen = {}, final = []
  for (const r of rows) { const pk = String(r[0]); if (seen[pk]) continue; seen[pk] = 1; final.push(r); localStorage.setItem(goalStorageKey(key, r[0], currentAccountId), String(r[1])) }
  _metasUpsert(key, final)
}
function _metasUpsert(key, rows) {
  if (!currentAccountId || typeof sbClient === 'undefined' || !sbClient) return
  const payload = rows.map(r => ({ account_id: String(currentAccountId), periodo: String(r[0]), indicador: key, valor: r[1] }))
  try { sbClient.from('social_metas').upsert(payload, { onConflict: 'account_id,periodo,indicador' }).then(res => { if (res && res.error) console.warn('meta upsert:', res.error.message) }).catch(() => {}) } catch (e) {}
}
async function metasFetchAll(accountId) {
  if (!accountId || typeof sbClient === 'undefined' || !sbClient) return
  try {
    const { data, error } = await sbClient.from('social_metas').select('periodo,indicador,valor').eq('account_id', String(accountId))
    if (error || !data) return
    data.forEach(r => localStorage.setItem(goalStorageKey(r.indicador, r.periodo, accountId), String(r.valor)))
    updateGoalDisplays(currentPeriod)
  } catch (e) {}
}
function loadGoal(key, period, accountId) {
  const pk = period === 0 ? 1 : period
  const s = localStorage.getItem(goalStorageKey(key, pk, accountId))
  if (s !== null && s !== '' && s !== 'NaN') return s                       // valor salvo (ignora corrupção antiga)
  const base = GOALS[key]; if (!base) return '0'
  if (base[pk] != null) return String(base[pk])                     // default exato do período
  if (RATE_GOALS.includes(key)) return String(base[7] ?? base[30] ?? 0)
  const refP = base[30] != null ? 30 : (base[7] != null ? 7 : 1)              // default escalado a partir do 30/7
  const d = periodDays(pk), rd = periodDays(refP)
  if (!d || !rd) return String(base[refP] ?? base[7] ?? 0)
  return String(Math.max(1, Math.round((base[refP] || 0) * d / rd)))
}
function getGoal(key) { const el = document.getElementById('goal-' + key); const v = el ? parseFloat(String(el.textContent).replace(',', '.')) : NaN; return isFinite(v) ? v : (parseFloat(loadGoal(key, currentPeriod, currentAccountId)) || 0) }
function getPrevLabel(period) {
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const end = new Date(); end.setDate(end.getDate() - 30)
  if (period === 1) return end.getDate() + ' ' + months[end.getMonth()]
  const start = new Date(end); start.setDate(start.getDate() - period + 1)
  return start.getDate() + ' ' + months[start.getMonth()] + ' – ' + end.getDate() + ' ' + months[end.getMonth()]
}

/* ── COMPARE ROW (legacy L3465-3482, verbatim) ── */
function setCompare(id, curr, prev, prefix, periodLabel, lowerIsBetter) {
  const el = document.getElementById(id); el.textContent = ''
  if (prev === null || prev === undefined) {
    const lbl = document.createElement('span'); lbl.className = 'mc-compare-label'
    lbl.style.fontStyle = 'italic'; lbl.textContent = 'Acumulando histórico...'
    el.appendChild(lbl); return
  }
  const lbl = document.createElement('span'); lbl.className = 'mc-compare-label'; lbl.textContent = 'vs ' + periodLabel
  const vals = document.createElement('div'); vals.className = 'mc-compare-vals'
  const prevEl = document.createElement('span'); prevEl.className = 'mc-compare-prev'
  prevEl.textContent = prefix ? fmtR(prev) : fmtN(prev)
  const d = curr - prev; const pct = prev > 0 ? ((d / prev) * 100) : 0; const isGood = lowerIsBetter ? (d <= 0) : (d >= 0)
  const deltaEl = document.createElement('span')
  deltaEl.className = 'mc-compare-delta ' + (isGood ? 'c-green' : 'c-red')
  const pctStr = prev > 0 ? ' (' + Math.abs(pct).toFixed(1) + '%)' : ''
  deltaEl.textContent = (d >= 0 ? '↑ +' : '↓ ') + (prefix ? fmtR(Math.abs(d)) : fmtN(Math.abs(d))) + pctStr
  vals.appendChild(prevEl); vals.appendChild(deltaEl); el.appendChild(lbl); el.appendChild(vals)
}

/* ── METRIC GOAL (legacy L3485-3514, verbatim) ── */
function applyMetric(key, curr, goal) {
  const pct = Math.min((curr / goal) * 100, 150); const clr = perfColor(pct); const diff = curr - goal
  _mcValColor(key, clr)
  setTimeout(() => { const p = document.getElementById('prog-' + key); p.style.width = Math.min(pct, 100) + '%'; p.className = 'mc-progress-fill bg-' + clr }, 80)
  document.getElementById('pct-' + key).textContent = Math.round(pct) + '%'
  document.getElementById('pct-' + key).className = 'mc-pct c-' + clr
  const diffEl = document.getElementById('diff-' + key)
  if (diff >= 0) { diffEl.textContent = '✓ +' + fmtN(diff) + ' acima da meta'; diffEl.className = 'mc-diff c-green' }
  else { diffEl.textContent = '↓ ' + fmtN(Math.abs(diff)) + ' abaixo da meta'; diffEl.className = 'mc-diff c-' + clr }
}
function applyMetricInverse(key, curr, goal) {
  const pct = (goal / curr) * 100; const clr = perfColor(pct); const diff = curr - goal
  _mcValColor(key, clr)
  setTimeout(() => { const p = document.getElementById('prog-' + key); p.style.width = Math.min(pct, 100) + '%'; p.className = 'mc-progress-fill bg-' + clr }, 80)
  document.getElementById('pct-' + key).textContent = Math.round(pct) + '%'
  document.getElementById('pct-' + key).className = 'mc-pct c-' + clr
  const diffEl = document.getElementById('diff-' + key)
  if (diff <= 0) { diffEl.textContent = '✓ ' + fmtR(Math.abs(diff)) + ' abaixo da meta'; diffEl.className = 'mc-diff c-green' }
  else { diffEl.textContent = '↑ ' + fmtR(diff) + ' acima da meta'; diffEl.className = 'mc-diff c-' + clr }
}
function applySpend(curr, budget) {
  const pct = (curr / budget) * 100; const clr = pct <= 100 ? 'green' : pct <= 120 ? 'yellow' : 'red'; const rem = budget - curr
  _mcValColor('spend', clr)
  setTimeout(() => { const p = document.getElementById('prog-spend'); p.style.width = Math.min(pct, 100) + '%'; p.className = 'mc-progress-fill bg-' + clr }, 80)
  document.getElementById('pct-spend').textContent = Math.round(pct) + '% do budget'
  document.getElementById('pct-spend').className = 'mc-pct c-' + clr
  const diffEl = document.getElementById('diff-spend')
  if (rem >= 0) { diffEl.textContent = fmtR(rem) + ' ainda disponível'; diffEl.className = 'mc-diff c-green' }
  else { diffEl.textContent = fmtR(Math.abs(rem)) + ' acima do budget'; diffEl.className = 'mc-diff c-red' }
}

/* ── SECTION CHIPS (legacy L3517-3520, verbatim) ── */
function setChips(id, chips) {
  const wrap = document.getElementById(id); if (!wrap) return; wrap.textContent = ''
  chips.forEach(txt => { const c = document.createElement('div'); c.className = 'sec-chip'; c.textContent = txt; wrap.appendChild(c) })
}

/* ── CHART (legacy L3523-3596, verbatim) ── */
function _polylineLength(pts) {
  const pairs = pts.trim().split(' ').map(p => p.split(',').map(Number))
  let len = 0
  for (let i = 1; i < pairs.length; i++) { const dx = pairs[i][0] - pairs[i - 1][0], dy = pairs[i][1] - pairs[i - 1][1]; len += Math.sqrt(dx * dx + dy * dy) }
  return len
}
function _animateChartLine(el, pts) {
  const len = _polylineLength(pts)
  el.style.strokeDasharray = len; el.style.strokeDashoffset = len
  el.style.transition = 'none'; void el.getBoundingClientRect()
  el.style.transition = 'stroke-dashoffset .9s cubic-bezier(.22,1,.36,1)'
  el.style.strokeDashoffset = '0'
}
function buildChart(chartData) {
  // BARRAS EMPILHADAS por dia: VERDE (seguiu) embaixo + VERMELHO (deixou) em cima; LÍQUIDO rotulado no topo.
  let { gained, lost, labels, dates } = chartData
  gained = (gained || []).slice(); lost = (lost || []).slice(); labels = (labels || []).slice(); dates = (dates || []).slice()
  if (gained.length === 0) { gained = [0]; lost = [0]; labels = labels.length ? labels : ['']; dates = dates.length ? dates : [''] }
  const n = gained.length
  const net = gained.map((g, i) => g - (lost[i] || 0))
  const totals = gained.map((g, i) => g + (lost[i] || 0))
  const W = 400, H = 110, padX = 8, padTop = 18, padBot = 4
  const maxTot = Math.max(...totals, 1)
  const chartH = H - padTop - padBot, baseY = H - padBot
  const hOf = v => (v / maxTot) * chartH
  const px = i => n > 1 ? padX + (i / (n - 1)) * (W - padX * 2) : W / 2
  const py = v => baseY - hOf(v)
  activeChartData = { gained, lost, net, labels, dates, px, py, W, H, yZero: baseY, n }
  // Elementos de linha/zero do gráfico antigo não são usados nas barras empilhadas.
  const zl = document.getElementById('chart-zero'); if (zl) zl.setAttribute('display', 'none')
  document.getElementById('chart-line').setAttribute('points', '')
  document.getElementById('chart-fill').setAttribute('d', '')
  document.getElementById('prev-line').setAttribute('points', '')
  const NS = 'http://www.w3.org/2000/svg'
  const bars = document.getElementById('chart-bars'); bars.textContent = ''
  const slot = (W - padX * 2) / Math.max(n, 1)
  const bw = Math.max(4, Math.min(slot * 0.6, 22))
  const _rect = (x, y, h, fill, rTop) => { const r = document.createElementNS(NS, 'rect'); r.setAttribute('x', (x - bw / 2).toFixed(2)); r.setAttribute('y', y.toFixed(2)); r.setAttribute('width', bw.toFixed(2)); r.setAttribute('height', Math.max(0, h).toFixed(2)); r.setAttribute('rx', rTop ? '2' : '0'); r.setAttribute('fill', fill); bars.appendChild(r) }
  for (let i = 0; i < n; i++) {
    const x = px(i), g = gained[i] || 0, l = lost[i] || 0
    const gh = hOf(g), lh = hOf(l)
    if (g > 0) _rect(x, baseY - gh, gh, '#16a34a', l === 0) // verde (seguiu) embaixo
    if (l > 0) _rect(x, baseY - gh - lh, lh, '#dc2626', true) // vermelho (deixou) em cima
  }
  // Rótulos HTML SOBREPOSTOS (não distorcem como o <text> do SVG esticado): números dentro + líquido no topo.
  const labelsG = document.getElementById('chart-data-labels'); labelsG.textContent = ''
  const _lab = (xPx, yPx, text, cls) => { const s = document.createElement('span'); s.className = cls; s.textContent = text; s.style.left = ((xPx / W) * 100) + '%'; s.style.top = ((yPx / H) * 100) + '%'; labelsG.appendChild(s); return s }
  const showInside = n <= 14
  for (let i = 0; i < n; i++) {
    const x = px(i), g = gained[i] || 0, l = lost[i] || 0
    const gh = hOf(g), lh = hOf(l)
    if (showInside) {
      if (g > 0 && gh >= 12) { const s = _lab(x, baseY - gh / 2, String(g), 'cdl-in'); s.style.transform = 'translate(-50%, -50%)' }
      if (l > 0 && lh >= 12) { const s = _lab(x, baseY - gh - lh / 2, String(l), 'cdl-in'); s.style.transform = 'translate(-50%, -50%)' }
    }
    const v = net[i], topY = baseY - hOf(totals[i])
    const s = _lab(x, topY, (v > 0 ? '+' : '') + fmtN(v), 'cdl' + (n > 12 ? ' cdl-sm' : '') + (v > 0 ? ' cdl-up' : v < 0 ? ' cdl-down' : ''))
    s.style.transform = 'translate(-50%, -118%)'
  }
  const xlWrap = document.getElementById('chart-xlabels'); xlWrap.textContent = ''
  const step = Math.max(1, Math.floor(n / 7))
  labels.forEach((l, i) => {
    if (i % step !== 0 && i !== n - 1) return
    const s = document.createElement('span'); s.className = 'x-label'; s.textContent = l
    s.style.left = (((px(i) - padX) / (W - padX * 2)) * 100) + '%'
    xlWrap.appendChild(s)
  })
}

/* ── CHART INTERACTIVITY (legacy L3599-3629 — no legado rodava solto no
   escopo global do <script>; aqui a wiring (getElementById dos elementos e
   addEventListener) foi movida pro onMounted/onUnmounted, já que o DOM do
   componente só existe depois de montado) ── */
let svgEl = null, chartOverlayEl = null, crosshairEl = null, dotCurrEl = null, dotPrevEl = null, tooltipEl = null
function _onChartMouseMove(e) {
  if (!activeChartData || !activeChartData.n) return
  const { gained, lost, net, dates, px, py, yZero, n } = activeChartData
  const rect = svgEl.getBoundingClientRect()
  const xPct = (e.clientX - rect.left) / rect.width
  const i = Math.max(0, Math.min(n - 1, Math.round(xPct * (n - 1))))
  const x = px(i)
  crosshairEl.setAttribute('x1', x); crosshairEl.setAttribute('x2', x); crosshairEl.removeAttribute('display')
  dotCurrEl.setAttribute('cx', x); dotCurrEl.setAttribute('cy', gained[i] > 0 ? py(gained[i]) : yZero); dotCurrEl.removeAttribute('display')
  dotPrevEl.setAttribute('display', 'none')
  document.getElementById('tt-date').textContent = dates[i] || ''
  document.getElementById('tt-curr-val').textContent = (net[i] >= 0 ? '+' : '') + net[i].toLocaleString('pt-BR')
  const _acc = net.slice(0, i + 1).reduce((a, b) => a + b, 0)
  document.getElementById('tt-prev-label').textContent = 'Acumulado no período'
  document.getElementById('tt-prev-val').textContent = (_acc >= 0 ? '+' : '') + _acc.toLocaleString('pt-BR')
  const dEl = document.getElementById('tt-delta')
  dEl.textContent = 'Líquido ' + (net[i] >= 0 ? '+' : '') + net[i].toLocaleString('pt-BR')
  dEl.className = 'tt-delta ' + (net[i] >= 0 ? 'c-green' : 'c-red')
  let tx = e.clientX + 16, ty = e.clientY - 60
  if (tx + 200 > window.innerWidth) tx = e.clientX - 216; if (ty < 8) ty = 8
  tooltipEl.style.left = tx + 'px'; tooltipEl.style.top = ty + 'px'; tooltipEl.style.display = 'block'
}
function _onChartMouseLeave() {
  crosshairEl.setAttribute('display', 'none'); dotCurrEl.setAttribute('display', 'none'); dotPrevEl.setAttribute('display', 'none'); tooltipEl.style.display = 'none'
}

/* ── FETCH DATA FROM SUPABASE (legacy L3632-3861, verbatim) ── */
function closestStoredPeriod(d) { return [1, 7, 14, 30].reduce((a, b) => Math.abs(b - d) < Math.abs(a - d) ? b : a) }
function localDate(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }

async function fetchData(accountId, period, customStart, customEnd) {
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const isHoje = period === 0
  const isCalMonth = period === 'monthfull' || period === 'sofar' || period === 'month'
  const isLastMonth = period === 'lastmonth'
  let refDate, histStartDate, storedPeriod, effectivePeriod
  if (customStart && customEnd) {
    refDate = new Date(customEnd + 'T12:00:00')
    const sd = new Date(customStart + 'T12:00:00')
    effectivePeriod = Math.max(1, Math.round((refDate - sd) / 86400000))
    storedPeriod = closestStoredPeriod(effectivePeriod)
    // Margem p/ trás suficiente p/ cobrir TAMBÉM a janela do período anterior (comparação bruta).
    // Sem margem, snaps começava em customStart e o bruto do período anterior ficava incompleto.
    histStartDate = new Date(sd); histStartDate.setDate(histStartDate.getDate() - (effectivePeriod + 2))
  } else if (isLastMonth) {
    // MÊS PASS: refDate = último dia do mês passado → todas as queries (followers,
    // engajamento, ads) recortam no mês anterior. storedPeriod=30 usa o snapshot
    // 30D capturado no fim daquele mês (proxy do mês; histórico diário já existe).
    const now = new Date()
    const lastDayPrev = new Date(now.getFullYear(), now.getMonth(), 0)
    refDate = new Date(lastDayPrev.getFullYear(), lastDayPrev.getMonth(), lastDayPrev.getDate(), 12)
    effectivePeriod = lastDayPrev.getDate()
    storedPeriod = 30
    histStartDate = new Date(refDate); histStartDate.setDate(histStartDate.getDate() - effectivePeriod - 5)
  } else if (isCalMonth) {
    const now = new Date()
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 12)
    refDate = now
    effectivePeriod = Math.max(1, now.getDate() - 1)
    storedPeriod = 99 // MÊS/ATÉ AGORA = mês-corrente real (snapshot MTD do coletor)
    histStartDate = new Date(firstOfMonth); histStartDate.setDate(histStartDate.getDate() - 5)
  } else {
    effectivePeriod = isHoje ? 1 : period; storedPeriod = period
    refDate = new Date()
    histStartDate = new Date(refDate); histStartDate.setDate(histStartDate.getDate() - 30 - Math.max(effectivePeriod, 1) - 5)
  }
  const refDateStr = localDate(refDate)
  const histStartStr = localDate(histStartDate)
  const prevRefDate = new Date(refDate)
  prevRefDate.setMonth(prevRefDate.getMonth() - 1)
  const prevRefDateStr = localDate(prevRefDate)
  const periodStart = new Date(refDate); periodStart.setDate(periodStart.getDate() - effectivePeriod)
  const periodStartStr = localDate(periodStart)
  // Janelas dia-precisas por período: HOJE = só hoje · 1D = só ontem · demais = rolante/mês.
  const _hojeBRT = localDate(new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })))
  const _ontemBRT = localDate(new Date(new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })).getTime() - 86400000))
  let followStart, followEnd
  if (isHoje) { followStart = followEnd = _hojeBRT }
  else if (period === 1) { followStart = followEnd = _ontemBRT }
  else if (typeof period === 'number' && !customStart) {
    // Dias corridos (7/14/30): N dias terminando ONTEM (régua do app — não conta o dia corrente
    // incompleto). Ex.: 7D = [ontem−6 .. ontem]. 1D acima = só ontem.
    followEnd = _ontemBRT
    followStart = localDate(new Date(new Date(_ontemBRT + 'T00:00:00').getTime() - (period - 1) * 86400000))
  }
  else if (isLastMonth) {
    // MÊS PASSADO = mês-calendário anterior EXATO (ex.: jun → 01/05..31/05). Antes pegava
    // refDate−effectivePeriod = 30/04..31/05 (off-by-one que incluía o último dia de abril).
    const _n = new Date()
    followStart = localDate(new Date(_n.getFullYear(), _n.getMonth() - 1, 1))
    followEnd = localDate(new Date(_n.getFullYear(), _n.getMonth(), 0))
  }
  else { followStart = periodStartStr; followEnd = refDateStr }
  const _fsMs = new Date(followStart + 'T00:00:00').getTime()
  const _spanDays = Math.round((new Date(followEnd + 'T00:00:00').getTime() - _fsMs) / 86400000) + 1
  const prevEndStr = localDate(new Date(_fsMs - 86400000))
  const prevStartStr = localDate(new Date(_fsMs - _spanDays * 86400000))
  const [snaps, engCurr, engPrev, cntCurr, cntPrev, filterRow, storyDailyCurr, storyDailyPrev, trueLastRows] = await Promise.all([
    sb(`daily_snapshots?account_id=eq.${accountId}&captured_at=gte.${histStartStr}&captured_at=lte.${refDateStr}&order=captured_at.asc&select=followers_count,captured_at,gained,lost`),
    sb(`engagement_snapshots?account_id=eq.${accountId}&period_days=eq.${storedPeriod}&captured_at=lte.${refDateStr}&order=captured_at.desc&limit=1&select=likes,saves,shares,comments,reach,views,total_interactions,accounts_engaged,profile_views,captured_at`),
    sb(`engagement_snapshots?account_id=eq.${accountId}&period_days=eq.${storedPeriod}&captured_at=lte.${prevRefDateStr}&order=captured_at.desc&limit=1&select=likes,saves,shares,comments,reach,views,total_interactions,accounts_engaged,profile_views,captured_at`),
    sb(`content_snapshots?account_id=eq.${accountId}&period_days=eq.${storedPeriod}&captured_at=lte.${refDateStr}&order=captured_at.desc&limit=1&select=posts_count,stories_count,reels_count,captured_at`),
    sb(`content_snapshots?account_id=eq.${accountId}&period_days=eq.${storedPeriod}&captured_at=lte.${prevRefDateStr}&order=captured_at.desc&limit=1&select=posts_count,stories_count,reels_count,captured_at`),
    sb(`campaign_filters?account_id=eq.${accountId}&select=selected_ids`),
    sb(`content_snapshots?account_id=eq.${accountId}&period_days=eq.1&captured_at=gte.${followStart}&captured_at=lte.${followEnd}&select=captured_at,story_shares,story_replies,stories_count,story_reach,story_interactions,story_navigation,story_nav_forward,story_nav_back,story_nav_exit,story_nav_next,story_profile_visits,story_follows`),
    sb(`content_snapshots?account_id=eq.${accountId}&period_days=eq.1&captured_at=gte.${prevStartStr}&captured_at=lte.${prevEndStr}&select=captured_at,story_shares,story_replies,stories_count,story_reach,story_interactions,story_navigation,story_nav_forward,story_nav_back,story_nav_exit,story_nav_next,story_profile_visits,story_follows`),
    // FRESCOR = saúde do coletor (global por perfil), NÃO o fim da janela escolhida.
    // Sem limite superior: pega a última coleta REAL, independente do período exibido.
    sb(`daily_snapshots?account_id=eq.${accountId}&order=captured_at.desc&limit=1&select=captured_at,followers_count`),
  ])
  const eng = engCurr[0] || { likes: 0, saves: 0, shares: 0, comments: 0 }
  const prevEng = engPrev[0] || null
  const cnt = cntCurr[0] || { posts_count: 0, stories_count: 0, reels_count: 0 }
  const prevCnt = cntPrev[0] || null
  const latest = snaps.length > 0 ? snaps[snaps.length - 1].followers_count : 0
  function fmtLabel(dateStr) { const d = new Date(dateStr + 'T12:00:00'); return effectivePeriod <= 7 ? days[d.getDay()] : d.getDate() + '/' + (d.getMonth() + 1) }
  function fmtFull(dateStr) { const d = new Date(dateStr + 'T12:00:00'); return d.getDate() + ' ' + months[d.getMonth()] }
  // NOVOS x SAÍRAM por dia. Régua do app = bruto follows_and_unfollows (gained/lost). PORÉM a Graph
  // API consolida o bruto ~2 dias depois (dias recentes vêm 0/0, mesmo o app já mostrando). Para NÃO
  // deixar dias zerados, dias recentes ainda 0/0 caem no LÍQUIDO pela contagem total (followers_count,
  // diário/tempo real) — preserva o líquido do período; quando a Meta consolida, o coletor re-coleta
  // e o bruto real entra no lugar automaticamente.
  const _idxByDate = {}; snaps.forEach((s, i) => { _idxByDate[s.captured_at] = i })
  const _netCountOf = s => { const i = _idxByDate[s.captured_at]; return i > 0 ? ((Number(s.followers_count) || 0) - (Number(snaps[i - 1].followers_count) || 0)) : 0 }
  const _daysAgo = s => Math.round((new Date(_hojeBRT + 'T00:00:00') - new Date(s.captured_at + 'T00:00:00')) / 864e5)
  // CONSOLIDADO = BRUTO PURO (seguiram−saíram), EXATAMENTE igual ao painel profissional do IG,
  // em TODOS os períodos (conferidos no painel: 7d Breno=3, 14d=165, 30d=1268). SEM fallback por
  // contagem: dia recente ainda não consolidado pela Meta conta 0 e é marcado "consolidando".
  // O número em tempo real (variação da contagem) vai SEPARADO, como PRÉVIA (previaReal, abaixo).
  // [novos, saíram, parcial] do dia.
  const _glOf = s => {
    const g = Number(s.gained) || 0, l = Number(s.lost) || 0
    if (g > 0 || l > 0) return [g, l, false]
    return [0, 0, _daysAgo(s) <= 2] // recente e 0/0 → ainda consolidando (não inventa pela contagem)
  }
  const chartSrc = snaps.filter(s => s.captured_at >= followStart && s.captured_at <= followEnd)
  // BRUTO puro (p/ o oficial confirmado e o sub-rótulo ▲novos ▼saíram).
  const _gl = chartSrc.map(_glOf)
  const grossGained = _gl.reduce((a, x) => a + x[0], 0)
  const grossLost = _gl.reduce((a, x) => a + x[1], 0)
  // Líquido do período = Σnovos − Σsaíram (régua do painel profissional; usado quando confirmado).
  const newFollowers = grossGained - grossLost
  // "parcial/consolidando": algum dia da janela ainda não fechou o bruto na Meta.
  const grossPartial = _gl.some(x => x[2])
  // GRÁFICO resiliente (sincronizado com o número): dia COM bruto → split ▲novos/▼saíram;
  // dia SEM bruto → variação real da contagem (sobe verde se +, desce vermelho se −). Nunca achata.
  const _chart = chartSrc.map(s => {
    const g = Number(s.gained) || 0, l = Number(s.lost) || 0
    if (g > 0 || l > 0) return [g, l]
    const n = _netCountOf(s)
    return n >= 0 ? [n, 0] : [0, -n]
  })
  const chartGained = _chart.map(x => x[0])
  const chartLost = _chart.map(x => x[1])
  // ── PRÉVIA TEMPO REAL (variação da contagem de seguidores; janela terminando HOJE) ──
  // Métrica DIFERENTE do bruto/IG. Em picos fica acima do que o IG contabiliza. Mesma régua em
  // todos os períodos → entre si nunca inverte (hoje ≤ 7d ≤ 14d ≤ 30d).
  const _countAtOrBefore = ds => { let v = null; for (let i = 0; i < snaps.length; i++) { if (snaps[i].captured_at <= ds) v = Number(snaps[i].followers_count) || 0; else break } return v }
  let _prevNumD = _hojeBRT, _prevBaseD
  if (period === 1) { _prevNumD = _ontemBRT; _prevBaseD = localDate(new Date(new Date(_ontemBRT + 'T00:00:00').getTime() - 86400000)) }
  else if (customStart && customEnd) { _prevNumD = customEnd; _prevBaseD = localDate(new Date(new Date(customStart + 'T00:00:00').getTime() - 86400000)) }
  else if (isLastMonth) { _prevNumD = followEnd; _prevBaseD = localDate(new Date(new Date(followStart + 'T00:00:00').getTime() - 86400000)) }
  else if (isCalMonth) { const _n = new Date(); _prevBaseD = localDate(new Date(_n.getFullYear(), _n.getMonth(), 0)) }
  else { _prevBaseD = localDate(new Date(new Date(_hojeBRT + 'T00:00:00').getTime() - (isHoje ? 1 : period) * 86400000)) }
  const _cNum = _countAtOrBefore(_prevNumD)
  let _cBase = _countAtOrBefore(_prevBaseD), _partialSince = null
  if (_cBase == null && snaps.length) { _cBase = Number(snaps[0].followers_count) || 0; _partialSince = snaps[0].captured_at } // histórico curto
  const previaReal = (_cNum != null && _cBase != null) ? (_cNum - _cBase) : null
  // CONFIRMADO PELO IG: o bruto (gained/lost) cobre todo o período? A Meta às vezes atrasa/para de
  // entregar follows_and_unfollows (ex.: parou em 13/06/2026). Se o último dia da janela já tem bruto,
  // mostramos o oficial (IGUAL ao IG); senão, mostramos a variação da contagem (fresca) "em consolidação".
  const lastGrossDay = snaps.reduce((mx, s) => (((Number(s.gained) || 0) > 0 || (Number(s.lost) || 0) > 0) && s.captured_at > mx) ? s.captured_at : mx, '')
  const confirmadoIG = !!lastGrossDay && followEnd <= lastGrossDay
  const chartLabels = chartSrc.length ? chartSrc.map(s => fmtLabel(s.captured_at)) : ['—']
  const chartDates = chartSrc.length ? chartSrc.map(s => fmtFull(s.captured_at)) : ['—']
  // Período anterior (mesma duração) imediatamente antes da janela — MESMA régua (bruto novos−saíram).
  const _prevWindow = snaps.filter(s => s.captured_at >= prevStartStr && s.captured_at <= prevEndStr)
  const _prevGained = _prevWindow.reduce((a, s) => a + (Number(s.gained) || 0), 0)
  const _prevLost = _prevWindow.reduce((a, s) => a + (Number(s.lost) || 0), 0)
  const prevNewFollowers = _prevWindow.length ? (_prevGained - _prevLost) : null
  // ── Conferência (F4): líquido === novos − saíram ──
  // (nota) o líquido pela contagem total e o bruto novos−saíram são medições distintas da Meta
  // e não batem exatamente — por isso o saldo principal usa a contagem total (confiável/tempo real).
  const engTotal = eng.likes + eng.saves + eng.shares + (eng.comments || 0)
  const prevEngTotal = (prevEng?.likes || 0) + (prevEng?.saves || 0) + (prevEng?.shares || 0)
  // Taxa de engajamento POR ALCANCE (padrão IG): (curtidas+comentários+salvamentos+compartilhamentos) / alcance × 100.
  const engRate = eng.reach > 0 ? ((engTotal / eng.reach) * 100).toFixed(1) : '0.0'
  const avgPerDay = effectivePeriod > 0 ? (newFollowers / effectivePeriod).toFixed(1) : '0.0'
  const pLabel = customStart && customEnd ? effectivePeriod + 'D' : _perShort(period, effectivePeriod)
  const followerDeltas = [{ p: pLabel, v: (newFollowers >= 0 ? '+' : '') + fmtN(newFollowers), dir: newFollowers >= 0 ? 'up' : 'down' }]
  if (prevNewFollowers > 0) { followerDeltas.push({ p: 'vs per. ant.', v: pctDiff(newFollowers, prevNewFollowers), dir: newFollowers >= prevNewFollowers ? 'up' : 'down' }) }
  // Ads: lê de campaign_insights aplicando o filtro de campanhas em tempo real
  const selectedIds = filterRow[0]?.selected_ids // null=todas, []=nenhuma, [ids]=filtradas
  const noneSelected = Array.isArray(selectedIds) && selectedIds.length === 0
  const safeIds = Array.isArray(selectedIds) ? selectedIds.filter(id => /^\d+$/.test(String(id))) : []
  const idFilter = safeIds.length > 0 ? `&campaign_id=in.(${safeIds.join(',')})` : ''
  function aggCi(rows) {
    if (!rows.length) return null
    const maxDate = rows[0].captured_at
    const d = rows.filter(r => r.captured_at === maxDate)
    return { spend: d.reduce((s, r) => s + parseFloat(r.spend || 0), 0), impressions: d.reduce((s, r) => s + parseInt(r.impressions || 0), 0), clicks: d.reduce((s, r) => s + parseInt(r.clicks || 0), 0), reach: d.reduce((s, r) => s + parseInt(r.reach || 0), 0), adEngagement: d.reduce((s, r) => s + parseInt(r.post_engagement || 0), 0), adLikes: d.reduce((s, r) => s + parseInt(r.likes || 0), 0), adComments: d.reduce((s, r) => s + parseInt(r.comments || 0), 0), adShares: d.reduce((s, r) => s + parseInt(r.shares || 0), 0), adSaves: d.reduce((s, r) => s + parseInt(r.saves || 0), 0) }
  }
  let spend = 0, impressions = 0, clicks = 0, reach = 0, prevSpend = null, adEngagement = 0, adLikes = 0, adComments = 0, adShares = 0, adSaves = 0
  // Ads dia-preciso p/ HOJE/1D: gasto do DIA exato (period_days=0 de hoje/ontem),
  // em vez do agregado "última captura" (que defasava o HOJE e somava 2 dias no 1D).
  let _adsPd = storedPeriod, _adsCur = `captured_at=lte.${refDateStr}&order=captured_at.desc`, _adsPrev = `captured_at=lte.${prevRefDateStr}&order=captured_at.desc`
  if (isHoje) { _adsPd = 0; _adsCur = `captured_at=eq.${_hojeBRT}`; _adsPrev = `captured_at=eq.${_ontemBRT}` }
  else if (period === 1) { const _anteBRT = localDate(new Date(new Date(_ontemBRT + 'T00:00:00').getTime() - 86400000)); _adsPd = 0; _adsCur = `captured_at=eq.${_ontemBRT}`; _adsPrev = `captured_at=eq.${_anteBRT}` }
  if (!noneSelected) {
    const [ciCurr, ciPrev] = await Promise.all([
      sb(`campaign_insights?account_id=eq.${accountId}&period_days=eq.${_adsPd}&${_adsCur}&limit=200&select=campaign_id,spend,impressions,clicks,reach,post_engagement,likes,comments,shares,saves,captured_at${idFilter}`),
      sb(`campaign_insights?account_id=eq.${accountId}&period_days=eq.${_adsPd}&${_adsPrev}&limit=200&select=campaign_id,spend,impressions,clicks,reach,post_engagement,likes,comments,shares,saves,captured_at${idFilter}`),
    ])
    const adsAgg = aggCi(ciCurr); const prevAdsAgg = aggCi(ciPrev)
    spend = adsAgg?.spend || 0; impressions = adsAgg?.impressions || 0; clicks = adsAgg?.clicks || 0; reach = adsAgg?.reach || 0
    adEngagement = adsAgg?.adEngagement || 0; adLikes = adsAgg?.adLikes || 0; adComments = adsAgg?.adComments || 0; adShares = adsAgg?.adShares || 0; adSaves = adsAgg?.adSaves || 0
    prevSpend = prevAdsAgg ? prevAdsAgg.spend : null
    // Reach DEDUPLICADO: sem filtro de campanhas, usa o total nível-conta (account_insights).
    // Somar reach por campanha infla (mesma pessoa em várias) — chegava a ~35% no real.
    if (safeIds.length === 0) {
      const aiCurr = await sb(`account_insights?account_id=eq.${accountId}&period_days=eq.${_adsPd}&${_adsCur}&limit=1&select=reach`).catch(() => [])
      if (aiCurr && aiCurr.length && aiCurr[0].reach != null) reach = parseInt(aiCurr[0].reach)
    }
  }
  // Custo por seguidor = gasto ÷ seguidores ganhos. Usa o MESMO número resiliente que o card exibe
  // (bruto quando confirmado; senão a variação da contagem) — o bruto sozinho zera durante a falha da Meta.
  const _cpsFollowers = confirmadoIG ? newFollowers : (previaReal != null ? previaReal : newFollowers)
  const cps = spend > 0 && _cpsFollowers > 0 ? spend / _cpsFollowers : 0
  const prevCps = prevSpend && prevNewFollowers > 0 ? prevSpend / prevNewFollowers : null
  const storyShares = storyDailyCurr.reduce((s, r) => s + (r.story_shares || 0), 0)
  const storyRep = storyDailyCurr.reduce((s, r) => s + (r.story_replies || 0), 0)
  const prevStoryShares = storyDailyPrev.length ? storyDailyPrev.reduce((s, r) => s + (r.story_shares || 0), 0) : null
  const prevStoryRep = storyDailyPrev.length ? storyDailyPrev.reduce((s, r) => s + (r.story_replies || 0), 0) : null
  const _sdSum = (arr, key) => arr.reduce((s, r) => s + (r[key] || 0), 0)
  const storyReach = _sdSum(storyDailyCurr, 'story_reach'), storyInter = _sdSum(storyDailyCurr, 'story_interactions'), storyNav = _sdSum(storyDailyCurr, 'story_navigation'), storyPV = _sdSum(storyDailyCurr, 'story_profile_visits'), storyFol = _sdSum(storyDailyCurr, 'story_follows')
  const prevStoryReach = storyDailyPrev.length ? _sdSum(storyDailyPrev, 'story_reach') : null, prevStoryInter = storyDailyPrev.length ? _sdSum(storyDailyPrev, 'story_interactions') : null, prevStoryNav = storyDailyPrev.length ? _sdSum(storyDailyPrev, 'story_navigation') : null, prevStoryPV = storyDailyPrev.length ? _sdSum(storyDailyPrev, 'story_profile_visits') : null, prevStoryFol = storyDailyPrev.length ? _sdSum(storyDailyPrev, 'story_follows') : null
  const storyNavF = _sdSum(storyDailyCurr, 'story_nav_forward'), storyNavB = _sdSum(storyDailyCurr, 'story_nav_back'), storyNavE = _sdSum(storyDailyCurr, 'story_nav_exit'), storyNavN = _sdSum(storyDailyCurr, 'story_nav_next')
  // Stories postados: soma diária dentro da janela (corrige HOJE = 1D). Posts/Reels NÃO mudam (são por-período).
  const storiesCount = storyDailyCurr.reduce((s, r) => s + (r.stories_count || 0), 0)
  const prevStoriesCount = storyDailyPrev.length ? storyDailyPrev.reduce((s, r) => s + (r.stories_count || 0), 0) : null
  // Etiqueta de comparação baseada no período anterior real
  const _mm = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const _fd = d => d.getDate() + ' ' + _mm[d.getMonth()]
  const pl = effectivePeriod <= 1 ? _fd(prevRefDate) : (() => { const s = new Date(prevRefDate.getTime() - effectivePeriod * 86400000); return _fd(s) + ' – ' + _fd(prevRefDate) })()
  return {
    followerTotal: (trueLastRows[0]?.followers_count ?? latest), newFollowers, prevNewFollowers, avgPerDay, bestDay: '—', engRate, followerDeltas, effectivePeriod, impressions, clicks, reach,
    chart: { gained: chartGained, lost: chartLost, labels: chartLabels, dates: chartDates },
    spend, prevSpend, cps, prevCps, adEngagement, adLikes, adComments, adShares, adSaves,
    eng: { likes: eng.likes, saves: eng.saves, shares: eng.shares, comments: eng.comments ?? 0, reach: eng.reach ?? 0, views: eng.views ?? 0, interactions: eng.total_interactions ?? 0, engaged: eng.accounts_engaged ?? 0, profileViews: eng.profile_views ?? 0, prevLikes: prevEng?.likes ?? null, prevSaves: prevEng?.saves ?? null, prevShares: prevEng?.shares ?? null, prevComments: prevEng?.comments ?? null, prevReach: prevEng?.reach ?? null, prevViews: prevEng?.views ?? null, prevInteractions: prevEng?.total_interactions ?? null, prevEngaged: prevEng?.accounts_engaged ?? null, prevProfileViews: prevEng?.profile_views ?? null },
    cnt: { posts: cnt.posts_count, stories: storiesCount, reels: cnt.reels_count, postsReels: cnt.posts_count + cnt.reels_count, prevPostsReels: prevCnt != null ? prevCnt.posts_count + prevCnt.reels_count : null, prevStories: prevStoriesCount },
    storyEng: { shares: storyShares, replies: storyRep, prevShares: prevStoryShares, prevReplies: prevStoryRep, reach: storyReach, interactions: storyInter, navigation: storyNav, profileVisits: storyPV, follows: storyFol, navForward: storyNavF, navBack: storyNavB, navExit: storyNavE, navNext: storyNavN, prevReach: prevStoryReach, prevInteractions: prevStoryInter, prevNavigation: prevStoryNav, prevProfileVisits: prevStoryPV, prevFollows: prevStoryFol },
    pl,
    // Última coleta REAL do perfil (não o fim da janela) → frescor honesto em todo período.
    trueLastSnap: trueLastRows.length ? trueLastRows[0].captured_at : null,
    grossGained, grossLost, grossPartial, previaReal, partialSince: _partialSince, confirmadoIG, lastGrossDay,
  }
}

/* ── ANÁLISE INTELIGENTE (legacy L3863-3984, verbatim) ── */
// Rótulos de período legíveis (evita "monthfullD"/"sofarD" etc.).
function _perShort(period, eff) {
  if (period === 0) return 'Hoje'
  if (period === 1) return 'Ontem'
  if (period === 'monthfull' || period === 'sofar') return 'Mês'
  if (period === 'lastmonth') return 'Mês passado'
  return (eff || period) + ' dias'
}
function _perPhrase(period, eff) {
  if (period === 'monthfull' || period === 'sofar') return 'no mês'
  if (period === 'lastmonth') return 'no mês passado'
  return 'em ' + (eff || period) + 'D'
}
function generateInsight(d, period, profileName) {
  const insights = []
  const nf = d.newFollowers, pnf = d.prevNewFollowers, avg = d.avgPerDay
  const likes = d.eng.likes, saves = d.eng.saves, shares = d.eng.shares, comments = d.eng.comments || 0
  const engTotal = likes + saves + shares + comments
  const prevEngTotal = (d.eng.prevLikes || 0) + (d.eng.prevSaves || 0) + (d.eng.prevShares || 0) + (d.eng.prevComments || 0)
  const engRate = parseFloat(d.engRate || '0')
  const reels = d.cnt.reels, posts = d.cnt.posts, stories = d.cnt.stories
  const totalContent = reels + posts + stories
  const stShares = d.storyEng.shares, stReplies = d.storyEng.replies
  const savesRate = engTotal > 0 ? saves / engTotal : 0
  const sharesRate = engTotal > 0 ? shares / engTotal : 0
  const r = pnf != null && pnf > 0 ? nf / pnf : null

  if (period === 0) {
    if (nf > 0 && r && r >= 1.5)
      insights.push({ t: 'green', s: `Ritmo acelerado hoje: +${nf} seguidor${nf !== 1 ? 'es' : ''} — ${Math.round((r - 1) * 100)}% acima do período anterior` })
    else if (nf > 0)
      insights.push({ t: 'blue', s: `+${nf} seguidor${nf !== 1 ? 'es' : ''} captados até agora` })
    else
      insights.push({ t: 'muted', s: `Nenhum seguidor novo registrado ainda hoje` })
    if (stories > 0) {
      if (stReplies >= 3) insights.push({ t: 'green', s: `${stories} storie${stories !== 1 ? 's' : ''} gerando conversa — ${stReplies} pessoas responderam via DM` })
      else if (stShares >= 3) insights.push({ t: 'blue', s: `${stories} storie${stories !== 1 ? 's' : ''} no ar com ${stShares} encaminhamentos` })
      else insights.push({ t: 'blue', s: `${stories} storie${stories !== 1 ? 's' : ''} publicado${stories !== 1 ? 's' : ''}hoje` })
    }
    if (reels > 0) insights.push({ t: 'green', s: `${reels} reel${reels !== 1 ? 's' : ''} no ar — formato de maior alcance orgânico` })
    else if (engTotal > 0) insights.push({ t: 'blue', s: `${fmtN(engTotal)} interações acumuladas hoje` })

  } else if (period === 1) {
    if (nf > 0 && r && r >= 1.3)
      insights.push({ t: 'green', s: `Ontem acelerou: +${nf} seguidor${nf !== 1 ? 'es' : ''} — ${pctDiff(nf, pnf)} acima do dia anterior` })
    else if (nf > 0 && r && r < 0.6)
      insights.push({ t: 'yellow', s: `Ontem abaixo do ritmo: +${nf} seguidor${nf !== 1 ? 'es' : ''} (${pctDiff(nf, pnf)} vs anterior)` })
    else if (nf > 0)
      insights.push({ t: 'blue', s: `Ontem: +${nf} novo${nf !== 1 ? 's' : ''} seguidor${nf !== 1 ? 'es' : ''}` })
    else
      insights.push({ t: 'muted', s: `Nenhum seguidor novo registrado ontem` })
    if (savesRate >= 0.15 && saves > 0)
      insights.push({ t: 'green', s: `${fmtN(saves)} salvamentos ontem — alto índice, conteúdo sendo guardado como referência` })
    else if (engTotal > 0) {
      const ep = prevEngTotal > 0 ? Math.round(((engTotal - prevEngTotal) / prevEngTotal) * 100) : null
      insights.push({
        t: ep != null && ep > 20 ? 'green' : ep != null && ep < -20 ? 'yellow' : 'blue',
        s: `${fmtN(engTotal)} interações ontem${ep != null ? ' (' + pctDiff(engTotal, prevEngTotal) + ' vs anterior)' : ''}`
      })
    }
    if (totalContent === 0)
      insights.push({ t: 'yellow', s: `Nenhum conteúdo publicado ontem — vale manter consistência diária` })
    else {
      const types = []
      if (reels > 0) types.push(`${reels} reel${reels !== 1 ? 's' : ''}`)
      if (posts > 0) types.push(`${posts} post${posts !== 1 ? 's' : ''}`)
      if (stories > 0) types.push(`${stories} storie${stories !== 1 ? 's' : ''}`)
      insights.push({ t: 'blue', s: types.join(', ') + ` publicado${totalContent !== 1 ? 's' : ''} ontem` })
    }

  } else {
    const ptx = _perPhrase(period, d.effectivePeriod)
    const epd = d.effectivePeriod || (typeof period === 'number' ? period : 1)
    if (nf > 0 && avg > 0 && r && r >= 1.5)
      insights.push({ t: 'green', s: `+${fmtN(nf)} seguidores ${ptx} — crescimento ${Math.round((r - 1) * 100)}% acima do período anterior (média +${avg}/dia)` })
    else if (nf > 0 && avg > 0 && r && r < 0.7)
      insights.push({ t: 'yellow', s: `+${fmtN(nf)} seguidores ${ptx} — ritmo desacelerou ${pctDiff(nf, pnf)} vs período anterior (média +${avg}/dia)` })
    else if (nf > 0)
      insights.push({ t: 'blue', s: `+${fmtN(nf)} seguidores ${ptx} — média de +${avg} novos por dia` })
    else
      insights.push({ t: 'muted', s: `Sem dados de crescimento disponíveis ${ptx}` })
    if (savesRate >= 0.15 && saves > 0)
      insights.push({ t: 'green', s: `Alto índice de salvamentos (${fmtN(saves)}) — conteúdo sendo guardado como referência de valor` })
    else if (sharesRate >= 0.12 && shares > 0)
      insights.push({ t: 'green', s: `Alto volume de compartilhamentos (${fmtN(shares)}) — conteúdo com alto potencial viral no período` })
    else if (engRate >= 5)
      insights.push({ t: 'green', s: `Taxa de engajamento em ${d.engRate}% — excelente, bem acima da média do setor` })
    else if (engRate >= 3)
      insights.push({ t: 'green', s: `Engajamento de ${d.engRate}% com ${fmtN(engTotal)} interações — muito bom ${ptx}` })
    else if (engRate >= 1)
      insights.push({ t: 'blue', s: `Engajamento de ${d.engRate}% ${ptx} — ${fmtN(likes)} curtidas · ${fmtN(saves)} salvamentos · ${fmtN(shares)} compartilhamentos` })
    else if (engRate > 0)
      insights.push({ t: 'yellow', s: `Engajamento abaixo de 1% ${ptx} — vale revisar formatos e horários de publicação` })
    if (totalContent === 0)
      insights.push({ t: 'yellow', s: `Nenhum conteúdo publicado ${ptx} — produção pausada no período` })
    else {
      const pubs = reels + posts
      const freq = (pubs / epd).toFixed(1)
      const parts = []
      if (reels > 0) parts.push(`${reels} reel${reels !== 1 ? 's' : ''}`)
      if (posts > 0) parts.push(`${posts} post${posts !== 1 ? 's' : ''}`)
      const freqLbl = parseFloat(freq) >= 0.7 ? ` — ritmo consistente (${freq}/dia)` : parseFloat(freq) >= 0.3 ? ` — ${freq}/dia` : ``
      if (parts.length > 0) insights.push({ t: 'blue', s: parts.join(' + ') + ` publicado${pubs !== 1 ? 's' : ''}${freqLbl}` })
    }
  }
  return insights.slice(0, 4)
}

function renderInsight(d, period) {
  const lbl = document.getElementById('insight-period-label')
  const list = document.getElementById('insight-list')
  if (!lbl || !list) return
  lbl.textContent = _perShort(period, d.effectivePeriod)
  const profileName = document.getElementById('apb-name')?.textContent || ''
  const items = generateInsight(d, period, profileName)
  list.textContent = ''
  items.forEach(item => {
    const row = document.createElement('div'); row.className = 'insight-item' + (item.t === 'muted' ? ' muted' : '')
    const dot = document.createElement('div'); dot.className = 'insight-dot ' + item.t
    const span = document.createElement('span'); span.textContent = item.s
    row.appendChild(dot); row.appendChild(span); list.appendChild(row)
  })
}

/* ── GUARDA DE FRESCOR: dado de hoje? senão, avisa (não mente em silêncio) (legacy L3987-4012, verbatim) ── */
function applyFreshness(lastSnapStr) {
  if (lastSnapStr !== undefined) window._lastSnap = lastSnapStr // guarda p/ reavaliação no relógio
  const banner = document.getElementById('freshness-banner')
  const status = document.getElementById('collection-status')
  if (!banner) return
  const snap = window._lastSnap
  if (snap === undefined) return // nenhum perfil carregado ainda
  const brt = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const today = `${brt.getFullYear()}-${String(brt.getMonth() + 1).padStart(2, '0')}-${String(brt.getDate()).padStart(2, '0')}`
  if (!snap) {
    banner.style.display = 'flex'
    banner.textContent = '⚠️ Sem dados coletados para este perfil.'
    if (status) { status.textContent = '⚠️ SEM DADOS'; status.style.color = '#ef4444'; status.style.opacity = '1' }
    return
  }
  const diff = Math.round((new Date(today + 'T00:00:00') - new Date(snap + 'T00:00:00')) / 864e5)
  const br = snap.split('-').reverse().join('/')
  if (diff <= 0) {
    banner.style.display = 'none'
    if (status) { status.textContent = 'ATUALIZADO HOJE'; status.style.color = ''; status.style.opacity = '' }
  } else {
    banner.style.display = 'flex'
    banner.textContent = `⚠️ Dados desatualizados — última coleta ${br} (${diff} dia${diff > 1 ? 's' : ''} atrás). O coletor pode estar parado (verifique o token da Meta).`
    if (status) { status.textContent = `⚠️ DESATUALIZADO · ${br}`; status.style.color = '#ef4444'; status.style.opacity = '1' }
  }
}

/* ── INFO: como contamos novos seguidores (modal do "?") (legacy L4015-4042, verbatim) ── */
function openFollowersInfo() {
  const ov = document.createElement('div')
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:18px;'
  ov.onclick = e => { if (e.target === ov) ov.remove() }
  const m = document.createElement('div')
  m.style.cssText = "background:#fff;max-width:470px;width:100%;max-height:85vh;overflow:auto;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.32);font-family:'IBM Plex Sans',sans-serif;color:#1e293b;"
  m.innerHTML =
    `<div style="padding:18px 20px;border-bottom:1px solid #eef2f7;display:flex;align-items:center;justify-content:space-between;gap:12px;">
      <div style="font-family:'Oswald',sans-serif;font-size:16px;font-weight:600;letter-spacing:.5px;">COMO CONTAMOS OS NOVOS SEGUIDORES</div>
      <button id="_fi_x" style="border:0;background:#f1f5f9;border-radius:8px;width:30px;height:30px;font-size:15px;cursor:pointer;color:#475569;">✕</button>
    </div>
    <div style="padding:18px 20px;font-size:13px;line-height:1.6;">
      <div style="background:#dcfce7;border:1px solid #86efac;border-radius:10px;padding:12px 14px;margin:0 0 14px;">
        <p style="margin:0 0 6px;"><b style="color:#15803d;">✓ Confirmado pelo Instagram</b></p>
        <p style="margin:0;">O período já tem o número oficial do Instagram (<b>seguiram − deixaram de seguir</b>). É exatamente o que aparece no painel profissional — se conferir no app, vai bater.</p>
      </div>
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 14px;margin:0 0 14px;">
        <p style="margin:0 0 6px;"><b style="color:#b45309;">⏳ Em consolidação</b></p>
        <p style="margin:0;">O Instagram ainda <b>não fechou</b> os números oficiais (seguiram/saíram) deste período. Isso costuma levar 1–2 dias, mas às vezes a Meta <b>atrasa bastante</b>. Enquanto isso, mostramos a <b>variação real de seguidores</b> (quantos a conta tem a mais), que é sempre atual. Quando o Instagram fecha, o card vira <b>✓ confirmado</b> sozinho.</p>
      </div>
      <p style="margin:0 0 14px;"><b>Por que pode mudar ao confirmar?</b> A variação da contagem e o "seguiram − saíram" do Instagram são medidas um pouco diferentes (a contagem inclui também quem desativou/reativou a conta), então em dias de pico podem divergir.</p>
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:12px 14px;">
        <p style="margin:0;"><b style="color:#0369a1;">Na prática:</b> o número <b>✓ confirmado</b> é o oficial do Instagram (use para apresentar). O <b>⏳ em consolidação</b> é o crescimento real mais recente, que o Instagram ainda vai oficializar.</p>
      </div>
    </div>`
  ov.appendChild(m); document.body.appendChild(ov)
  m.querySelector('#_fi_x').onclick = () => ov.remove()
}

// ── ABAS DE ENGAJAMENTO (Geral/Reels/Posts/Stories/Anúncios) ──
let _engTab = 'geral'
let _engCtx = null
const _IMAP = { likes: 'curtidas', comments: 'comentarios', saves: 'salvamentos', shares: 'compartilhamentos' }
function setEngTab(tab) {
  _engTab = tab
  document.querySelectorAll('#eng-tabs .eng-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab))
  renderInteracoes()
}
function renderInteracoes() {
  const ctx = _engCtx; if (!ctx) return
  const tab = _engTab
  ;['likes', 'comments', 'saves', 'shares'].forEach(k => {
    const key = _IMAP[k]
    const io = ctx.inter ? ctx.inter[key] : null
    // valor da aba: live tem por-tipo; sem live só a aba Geral (coletado).
    const val = io ? (io[tab] != null ? io[tab] : io.geral) : ((tab === 'geral') ? (ctx.eng[k] || 0) : 0)
    animCount(document.getElementById('eng-' + k), val)
    // comparativo: mesmo tipo na janela anterior.
    const ioAnt = ctx.ant ? ctx.ant[key] : null
    const prev = ioAnt ? (ioAnt[tab] != null ? ioAnt[tab] : ioAnt.geral) : ((tab === 'geral') ? ctx.eng['prev' + k.charAt(0).toUpperCase() + k.slice(1)] : null)
    setCompare('cmp-' + k, val, prev, '', ctx.pl, false)
    applyMetric(k, val, getGoal(k))
  })
}

/* ── MAIN UPDATE (legacy L4045-4157, verbatim) ── */
function update(d, period) {
  const pl = d.pl
  applyFreshness(d.trueLastSnap) // frescor = última coleta REAL do coletor, igual em qualquer período
  const totalEl = document.getElementById('total-followers'); if (totalEl) animCountFull(totalEl, (d.live ? d.live.followers_count : d.followerTotal))
  // Status ao vivo × fallback honesto (nunca esconde que é dado coletado quando a Meta falha).
  const _lsu = document.getElementById('live-status')
  if (_lsu) {
    if (d.live) { _lsu.style.color = '#16a34a'; _lsu.textContent = '● ao vivo (Meta)' }
    else {
      let q = ''
      try { q = new Date(d.trueLastSnap).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) } catch (e) {}
      _lsu.style.color = '#b45309'; _lsu.textContent = '⚠ ao vivo indisponível — última coleta ' + q
    }
  }
  // RESILIENTE: se o período está confirmado pela Meta (bruto cobre a janela) → número oficial = IGUAL ao IG.
  // Senão (Meta atrasada/sem dado) → variação real da contagem, marcada "em consolidação". Nunca zera.
  // AO VIVO (exato da Meta) quando disponível; senão cai na lógica de consolidação do coletado.
  const confirmado = d.live ? true : d.confirmadoIG
  const headlineVal = d.live ? d.live.novos.total : (confirmado ? d.newFollowers : (d.previaReal != null ? d.previaReal : d.newFollowers))
  const newEl = document.getElementById('new-followers-val'); if (newEl) animCount(newEl, headlineVal) // Total (líquido)
  // 3 linhas de fonte igual: Seguidores · Deixaram de seguir · Total.
  const gEl = document.getElementById('nf-gained'), lEl = document.getElementById('nf-lost')
  if (d.live) {
    if (gEl) animCount(gEl, d.live.novos.seguiu)
    if (lEl) animCount(lEl, d.live.novos.deixou)
  } else if (confirmado) {
    if (gEl) animCount(gEl, d.grossGained)
    if (lEl) animCount(lEl, d.grossLost)
  } else {
    if (gEl) { gEl.textContent = '—'; gEl.removeAttribute('title'); gEl.classList.remove('tem-tooltip') }
    if (lEl) { lEl.textContent = '—'; lEl.removeAttribute('title'); lEl.classList.remove('tem-tooltip') }
  }
  // Selo de status: ✓ confirmado pelo IG (verde) ou ⏳ em consolidação (âmbar — número é a contagem real).
  const prevEl = document.getElementById('previa-followers')
  if (prevEl) {
    prevEl.style.display = 'block'
    if (confirmado) {
      prevEl.innerHTML = `<span style="display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:800;color:#15803d;background:#dcfce7;border:1px solid #86efac;border-radius:6px;padding:2px 8px;">✓ confirmado pelo Instagram</span>`
    } else {
      prevEl.innerHTML = `<span style="display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:800;color:#b45309;background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:2px 8px;">⏳ em consolidação</span>` +
        `<div style="font-size:9.5px;line-height:1.35;color:#9aa0a6;font-weight:500;margin-top:3px;">Número pela variação real de seguidores. O Instagram ainda não fechou os números oficiais (seguiram/saíram) deste período — quando fechar, aparece o ✓ confirmado.</div>`
    }
  }
  buildChart(d.chart)
  // Comparação só quando confirmado (no período em consolidação o "anterior" do bruto distorceria).
  const cmpEl = document.getElementById('cmp-followers')
  // AO VIVO: compara total atual vs total do período ANTERIOR (exato, mesma janela). Senão, coletado.
  if (d.live) setCompare('cmp-followers', d.live.novos.total, d.live.anterior ? d.live.anterior.novos.total : null, '', pl, false)
  else if (confirmado) setCompare('cmp-followers', d.newFollowers, d.prevNewFollowers, '', pl, false)
  else if (cmpEl) cmpEl.innerHTML = ''
  applyMetric('followers', headlineVal, getGoal('followers'))
  const engTotal = d.eng.likes + d.eng.saves + d.eng.shares + (d.eng.comments || 0)
  const prevEngTotal = d.eng.prevLikes + d.eng.prevSaves + d.eng.prevShares + (d.eng.prevComments || 0)
  const _avgShown = (d.effectivePeriod > 0 ? (headlineVal / d.effectivePeriod) : headlineVal).toFixed(1)
  setChips('chips-followers', ['Média: +' + _avgShown + '/dia', 'Taxa de eng.: ' + d.engRate + '%', 'Engajamento total: ' + fmtN(engTotal)])
  // Investimento AO VIVO = gasto de TODAS as campanhas da conta de anúncio do perfil (exato). null = perfil sem ads.
  const _inv = (d.live && d.live.investimento != null) ? d.live.investimento : d.spend
  const _invAnt = (d.live && d.live.anterior) ? d.live.anterior.investimento : d.prevSpend
  document.getElementById('ads-spend-val').textContent = _inv > 0 ? fmtR(_inv) : 'R$ —'
  document.getElementById('ads-cps-val').textContent = d.cps > 0 ? fmtR(d.cps) : 'R$ —'
  setCompare('cmp-spend', _inv, _invAnt, 'R$ ', pl, true)
  setCompare('cmp-cps', d.cps, d.prevCps, 'R$ ', pl, true)
  applySpend(_inv, getGoal('spend'))
  if (d.cps > 0) applyMetricInverse('cps', d.cps, getGoal('cps'))
  if (d.cps > 0) { const gcps = getGoal('cps'); _mcBorderColor('cps', perfColor((gcps / d.cps) * 100)) } else { _mcBorderColor('cps', '') }
  const adsChips = []
  if (d.impressions > 0) adsChips.push(fmtN(d.impressions) + ' impressões')
  if (d.clicks > 0) adsChips.push(fmtN(d.clicks) + ' cliques')
  if (d.reach > 0) adsChips.push(fmtN(d.reach) + ' alcance')
  if (!adsChips.length) adsChips.push('Sem dados de Ads no período')
  setChips('chips-ads', adsChips)
  const cpi = (d.adEngagement > 0 && d.spend > 0) ? d.spend / d.adEngagement : 0
  const cpl = (d.adLikes > 0 && d.spend > 0) ? d.spend / d.adLikes : 0
  document.getElementById('ads-cpi-val').textContent = cpi > 0 ? fmtR(cpi) : 'R$ —'
  document.getElementById('ads-cpl-val').textContent = cpl > 0 ? fmtR(cpl) : 'R$ —'
  if (cpi > 0) { const g = getGoal('cpi'); applyMetricInverse('cpi', cpi, g); _mcBorderColor('cpi', perfColor((g / cpi) * 100)) } else { _mcBorderColor('cpi', '') }
  if (cpl > 0) { const g = getGoal('cpl'); applyMetricInverse('cpl', cpl, g); _mcBorderColor('cpl', perfColor((g / cpl) * 100)) } else { _mcBorderColor('cpl', '') }
  const custoChips = []
  if (d.clicks > 0 && d.spend > 0) custoChips.push('CPC ' + fmtR(d.spend / d.clicks))
  if (d.impressions > 0 && d.spend > 0) custoChips.push('CPM ' + fmtR(d.spend / d.impressions * 1000))
  if (d.reach > 0 && d.spend > 0) custoChips.push('Custo/alcance ' + fmtR(d.spend / d.reach))
  if (d.adComments > 0 && d.spend > 0) custoChips.push('Custo/comentário ' + fmtR(d.spend / d.adComments))
  if (d.adSaves > 0 && d.spend > 0) custoChips.push('Custo/salvamento ' + fmtR(d.spend / d.adSaves))
  if (d.adShares > 0 && d.spend > 0) custoChips.push('Custo/compart. ' + fmtR(d.spend / d.adShares))
  if (!custoChips.length) custoChips.push('Sem custos no período')
  setChips('chips-ads-custo', custoChips)
  // Curtidas/Comentários/Salvamentos/Compart. por ABA (Geral/Reels/Posts/Stories/Anúncios). Guarda o contexto
  // e renderiza a aba ativa. AO VIVO tem o split por tipo; sem live, só a aba Geral (coletado).
  _engCtx = {
    inter: (d.live && d.live.interacoes) ? d.live.interacoes : null,
    ant: (d.live && d.live.anterior && d.live.anterior.interacoes) ? d.live.anterior.interacoes : null,
    eng: d.eng, pl,
  }
  renderInteracoes()
  // Cards novos (alcance/visualizações/interações/contas engajadas/visitas) — sem meta/progresso.
  // Alcance/Visualizações/Interações/Visitas: AO VIVO (exato) quando disponível; senão coletado.
  const engLive = d.live ? { reach: d.live.engajamento.reach, views: d.live.engajamento.views, interactions: d.live.engajamento.interacoes, profileViews: d.live.engajamento.visitas } : null
  const engAnt = (d.live && d.live.anterior) ? { reach: d.live.anterior.engajamento.reach, views: d.live.anterior.engajamento.views, interactions: d.live.anterior.engajamento.interacoes, profileViews: d.live.anterior.engajamento.visitas } : null
  ;[['reach', 'reach', 'prevReach'], ['views', 'views', 'prevViews'], ['interactions', 'interactions', 'prevInteractions'], ['profile-views', 'profileViews', 'prevProfileViews']].forEach(([id, k, pk]) => {
    const val = engLive ? (engLive[k] || 0) : (d.eng[k] || 0)
    animCount(document.getElementById('eng-' + id), val)
    setCompare('cmp-' + id, val, engAnt ? engAnt[k] : d.eng[pk], '', pl, false)
    applyMetric(id, val, getGoal(id))
  })
  const avgPerPost = d.cnt.posts > 0 ? Math.round(d.eng.likes / d.cnt.posts) : 0
  setChips('chips-eng', ['Taxa de eng.: ' + d.engRate + '%', 'Comentários: ' + fmtN(d.eng.comments || 0), 'Média curtidas/post: ' + fmtN(avgPerPost), prevEngTotal > 0 ? 'Total: ' + fmtN(engTotal) + ' vs ' + fmtN(prevEngTotal) + ' (' + pctDiff(engTotal, prevEngTotal) + ')' : 'Total engajamento: ' + fmtN(engTotal)])
  // Engajamento de Stories agora é a aba "Stories" da seção 03 (Engajamento) — seção separada removida.
  animCount(document.getElementById('cnt-stories'), d.cnt.stories)
  setCompare('cmp-stories', d.cnt.stories, d.cnt.prevStories, '', pl, false); applyMetric('stories', d.cnt.stories, getGoal('stories'))
  animCount(document.getElementById('cnt-posts-reels'), d.cnt.postsReels)
  setCompare('cmp-posts-reels', d.cnt.postsReels, d.cnt.prevPostsReels, '', pl, false); applyMetric('posts-reels', d.cnt.postsReels, getGoal('posts-reels'))
  const totalContent = d.cnt.postsReels + d.cnt.stories
  const ep = d.effectivePeriod || period
  setChips('chips-cnt', ['Total: ' + totalContent + ' publicações', 'Freq.: ' + (totalContent / ep).toFixed(1) + '/dia', d.cnt.prevPostsReels > 0 ? 'Posts+Reels ' + pctDiff(d.cnt.postsReels, d.cnt.prevPostsReels) + ' vs ' + pl : 'Posts+Reels no período: ' + d.cnt.postsReels])
  renderInsight(d, period)
  renderGoalBar(d)
  // Stories arc: anel no perfil ativo + atualiza todos os botões
  const apbRingWrap = document.getElementById('apb-ring-wrap')
  if (apbRingWrap) apbRingWrap.classList.toggle('has-stories', d.cnt.stories > 0)
  updateStoriesRings()
}

/* ── BUILD UI (legacy L4160-4208, verbatim) ── */
async function buildProfiles() {
  const accounts = await sb('accounts?order=name.asc&select=id,name,username,picture_url,accent_color')
  accounts.forEach(acc => {
    if (acc.picture_url) ACCOUNT_PICS[acc.name] = acc.picture_url
    if (acc.accent_color && PROFILE_THEMES[acc.name]) { PROFILE_THEMES[acc.name].accent = acc.accent_color; PROFILE_THEMES[acc.name].light = acc.accent_color + '1a'; PROFILE_THEMES[acc.name].mid = acc.accent_color + '4d' }
  })
  const wrap = document.getElementById('profile-select')
  wrap.textContent = ''
  accounts.forEach((acc, idx) => {
    const btn = document.createElement('button'); btn.className = 'profile-btn' + (idx === 0 ? ' active' : ''); btn.dataset.id = acc.id
    const t = PROFILE_THEMES[acc.name] || { accent: '#1A3A6B' }
    const av = document.createElement('div'); av.className = 'av'; av.style.background = t.accent; av.dataset.accountId = acc.id
    if (acc.picture_url) { const img = document.createElement('img'); img.src = acc.picture_url; img.alt = acc.name.charAt(0); av.appendChild(img) }
    else { av.textContent = acc.name.charAt(0) }
    const ringWrap = document.createElement('div'); ringWrap.className = 'av-ring-wrap'; ringWrap.dataset.accountId = acc.id; ringWrap.appendChild(av)
    btn.appendChild(ringWrap); btn.appendChild(document.createTextNode(' ' + acc.username))
    btn.addEventListener('click', () => {
      document.querySelectorAll('.profile-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      _acIdx = idx
      try { localStorage.setItem('dash_account', String(acc.id)) } catch (e) {}
      currentAccountId = acc.id; applyProfileTheme(acc.name); updateGoalDisplays(currentPeriod); metasFetchAll(acc.id); loadCampaignFilterBadge()
      const wrapper = document.querySelector('.wrapper')
      _fadeSwap(wrapper, () => refresh())
    })
    wrap.appendChild(btn)
  })
  _allAccounts = accounts
  if (accounts.length > 0) {
    let selIdx = 0
    try { const savedId = localStorage.getItem('dash_account'); if (savedId != null) { const i = accounts.findIndex(a => String(a.id) === savedId); if (i >= 0) selIdx = i } } catch (e) {}
    _acIdx = selIdx
    currentAccountId = accounts[selIdx].id; applyProfileTheme(accounts[selIdx].name)
    document.querySelectorAll('.profile-btn').forEach((b, i) => b.classList.toggle('active', i === selIdx))
    setTimeout(loadCampaignFilterBadge, 100)
  }
  updateStoriesRings()
}

async function updateStoriesRings() {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const rows = await sb(`content_snapshots?captured_at=eq.${today}&period_days=lte.1&select=account_id,stories_count&order=period_days.asc`)
    const hasStories = new Set((rows || []).filter(r => (r.stories_count || 0) > 0).map(r => String(r.account_id)))
    document.querySelectorAll('.av-ring-wrap[data-account-id]').forEach(wrap => {
      wrap.classList.toggle('has-stories', hasStories.has(String(wrap.dataset.accountId)))
    })
  } catch (e) {}
}

/* ── AUTO-CYCLE (legacy L4211-4306, verbatim, exceto os 4 document.
   addEventListener(...) do fim, que rodavam soltos no legado e aqui são
   registrados em onMounted/removidos em onUnmounted) ── */
let _allAccounts = []
let _acIdx = 0
let _acTimer = null
let _acCountdown = null
let _acInactivity = null
let _acSecsLeft = 0
let _acEnabled = (localStorage.getItem('ac_enabled') !== '0')
const AC_INACTIVITY = 5    // segundos sem mouse p/ ativar
const AC_DURATION = 40     // segundos por perfil

function _acSwitchTo(idx) {
  if (!_acEnabled) { _acStopCycle(); return }
  const wrapper = document.querySelector('.wrapper')
  _fadeSwap(wrapper, () => {
    _acIdx = idx
    const acc = _allAccounts[idx]
    document.querySelectorAll('.profile-btn').forEach((b, i) => b.classList.toggle('active', i === idx))
    currentAccountId = acc.id; applyProfileTheme(acc.name); updateGoalDisplays(currentPeriod); metasFetchAll(acc.id); refresh(); loadCampaignFilterBadge()
    _acSecsLeft = AC_DURATION
  })
}

function _acStartCycle() {
  if (!_acEnabled || _acTimer || _allAccounts.length <= 1) return
  _acSecsLeft = AC_DURATION
  const prog = document.getElementById('autocycle-progress')
  prog.style.transition = 'none'; prog.style.width = '0%'
  requestAnimationFrame(() => {
    prog.style.transition = 'width ' + AC_DURATION + 's linear'
    prog.style.width = '100%'
  })
  _acCountdown = setInterval(() => {
    _acSecsLeft--
    const m = Math.floor(_acSecsLeft / 60)
    const s = String(_acSecsLeft % 60).padStart(2, '0')
    const el = document.getElementById('ac-countdown'); if (el) el.textContent = m + ':' + s
  }, 1000)
  _acTimer = setInterval(() => {
    _acSwitchTo((_acIdx + 1) % _allAccounts.length)
    _acSecsLeft = AC_DURATION
    prog.style.transition = 'none'; prog.style.width = '0%'
    requestAnimationFrame(() => {
      prog.style.transition = 'width ' + AC_DURATION + 's linear'
      prog.style.width = '100%'
    })
  }, AC_DURATION * 1000)
}

function _acStopCycle() {
  clearInterval(_acTimer); clearInterval(_acCountdown)
  _acTimer = null; _acCountdown = null
  const badge = document.getElementById('autocycle-badge')
  const prog = document.getElementById('autocycle-progress')
  if (badge) badge.style.display = 'none'
  if (prog) { prog.style.transition = 'none'; prog.style.width = '0%' }
}

function _acResetInactivity() {
  if (!_acEnabled) return
  if (_acTimer) _acStopCycle()
  clearTimeout(_acInactivity)
  _acInactivity = setTimeout(_acStartCycle, AC_INACTIVITY * 1000)
}

function toggleAutoCycle() {
  _acEnabled = !_acEnabled
  const btn = document.getElementById('ac-toggle-btn')
  const track = document.getElementById('ac-toggle-track')
  if (_acEnabled) {
    btn.classList.add('on'); track.classList.add('on')
    _acResetInactivity()
  } else {
    btn.classList.remove('on'); track.classList.remove('on')
    _acStopCycle()
    clearTimeout(_acInactivity); _acInactivity = null
  }
  localStorage.setItem('ac_enabled', _acEnabled ? '1' : '0')
}

function initAutoCycleToggle() {
  const saved = localStorage.getItem('ac_enabled')
  if (saved === '0') {
    _acEnabled = false
    const btn = document.getElementById('ac-toggle-btn')
    const track = document.getElementById('ac-toggle-track')
    if (btn) btn.classList.remove('on')
    if (track) track.classList.remove('on')
    _acStopCycle(); clearTimeout(_acInactivity); _acInactivity = null
  }
}

/* ── PERÍODOS / HEADER / METAS (legacy L4307-4347, verbatim) ── */
let _hojeTimer = null
function buildPeriodTabs() {
  const wrap = document.getElementById('period-tabs')
  wrap.innerHTML = ''
  PERIODS.forEach(p => {
    const btn = document.createElement('button'); btn.className = 'ptab' + (p.value === currentPeriod ? ' active' : '')
    if (p.value === 0) { const dot = document.createElement('span'); dot.style.cssText = 'display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--green);margin-right:5px;animation:pulse 2s infinite;vertical-align:middle;'; btn.appendChild(dot) }
    btn.appendChild(document.createTextNode(p.label))
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ptab').forEach(b => b.classList.remove('active')); btn.classList.add('active')
      currentPeriod = p.value; try { localStorage.setItem('dash_period', String(p.value)) } catch (e) {} currentStartDate = null; currentEndDate = null
      document.getElementById('custom-start').value = ''; document.getElementById('custom-end').value = ''; document.getElementById('custom-clear-btn').style.display = 'none'
      updateGoalDisplays(p.value); refresh()
      if (_hojeTimer) { clearInterval(_hojeTimer); _hojeTimer = null }
      if (p.value === 0) { _hojeTimer = setInterval(refresh, 10 * 60 * 1000) }
    })
    wrap.appendChild(btn)
  })
}
function toggleHeader() {
  const c = document.getElementById('header-collapsible')
  const btn = document.getElementById('header-toggle')
  const isNowCollapsed = c.classList.toggle('collapsed')
  btn.querySelector('.ht-arrow').style.transform = isNowCollapsed ? 'rotate(180deg)' : 'rotate(0deg)'
  localStorage.setItem('hdr_collapsed', isNowCollapsed ? '1' : '0')
}
function restoreHeaderState() {
  if (localStorage.getItem('hdr_collapsed') === '1') {
    const c = document.getElementById('header-collapsible')
    const btn = document.getElementById('header-toggle')
    c.classList.add('collapsed')
    if (btn) btn.querySelector('.ht-arrow').style.transform = 'rotate(180deg)'
  }
}
function updateGoalDisplays(period) { Object.keys(GOALS).forEach(k => { const el = document.getElementById('goal-' + k); if (el) el.textContent = loadGoal(k, period, currentAccountId) }) }
function watchGoals() { document.querySelectorAll('.mc-goal-val').forEach(el => { el.addEventListener('blur', () => { const key = el.id.replace('goal-', ''); saveGoal(key, el.textContent.trim()); updateGoalDisplays(currentPeriod); refresh() }); el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); el.blur() } }) }) }
let _refreshId = 0
async function refresh() {
  if (!currentAccountId) return
  const myId = ++_refreshId
  const _ls = document.getElementById('live-status'); if (_ls) _ls.innerHTML = '<span style="opacity:.7">⟳ atualizando ao vivo…</span>'
  // PARALELO: coletado (gráficos/histórico) + KPIs ao vivo + série do gráfico — juntos, não em fila.
  const [data, live, serie] = await Promise.all([
    fetchData(currentAccountId, currentPeriod, currentStartDate, currentEndDate),
    buscarKpisAoVivo(currentAccountId, currentPeriod, currentStartDate, currentEndDate),
    buscarSerieNovos(currentAccountId, currentPeriod, currentStartDate, currentEndDate),
  ])
  if (myId !== _refreshId) return
  data.live = live // null → a tela cai no coletado
  // GRÁFICO novos/dia AO VIVO exato: só sobrescreve quando o KPI ao vivo funcionou (consistência).
  if (live && serie && serie.length) {
    const _d3 = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'], _m3 = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const curto = serie.length <= 7
    data.chart = {
      gained: serie.map(s => s.seguiu), lost: serie.map(s => s.deixou),
      labels: serie.map(s => { const dt = new Date(s.label + 'T12:00:00'); return curto ? _d3[dt.getDay()] : (dt.getDate() + '/' + (dt.getMonth() + 1)) }),
      dates: serie.map(s => { const dt = new Date(s.label + 'T12:00:00'); return dt.getDate() + ' ' + _m3[dt.getMonth()] }),
    }
  }
  update(data, currentPeriod)
}
// Campos de data sempre visíveis: ao escolher AS DUAS datas, aplica sozinho (sem botão). O ✕ aparece pra limpar.
function onCustomDateChange() {
  const s = document.getElementById('custom-start').value, e = document.getElementById('custom-end').value
  document.getElementById('custom-clear-btn').style.display = (s || e) ? 'inline-flex' : 'none'
  if (!s || !e) return
  if (s > e) { alert('A data inicial deve ser anterior à data final.'); return }
  currentStartDate = s; currentEndDate = e
  document.querySelectorAll('.ptab').forEach(b => b.classList.remove('active'))
  refresh()
}
function clearCustomRange() {
  currentStartDate = null; currentEndDate = null
  document.getElementById('custom-start').value = ''; document.getElementById('custom-end').value = ''
  document.getElementById('custom-clear-btn').style.display = 'none'
  document.querySelectorAll('.ptab').forEach((b, i) => { if (i === 1) b.classList.add('active') })
  currentPeriod = 7; updateGoalDisplays(7); refresh()
}

/* ── FADE SWAP — fetch-first, then smooth out→swap→in (legacy L5410-5422, verbatim) ── */
function _fadeSwap(el, swapFn) {
  el.style.transition = 'opacity .18s ease'
  el.style.opacity = '0'
  setTimeout(() => {
    swapFn()
    // 80ms buffer: let browser fully paint new DOM before fading in
    setTimeout(() => {
      el.style.transition = 'opacity .38s cubic-bezier(.22,1,.36,1)'
      el.style.opacity = '1'
      setTimeout(() => { el.style.transition = ''; el.style.opacity = '' }, 420)
    }, 80)
  }, 190)
}

/* ── RELÓGIO (legacy L5216-5236, verbatim exceto _clockTimer, que agora guarda
   o id do setInterval pra poder limpar no onUnmounted — ver nota no topo) ── */
function updateCollectionStatus() {
  // Status baseado no FRESCOR REAL do dado (não em horário agendado, que mentia
  // mostrando "coletou" mesmo com o coletor parado). Reavalia p/ pegar virada de dia.
  applyFreshness()
}
let _clockTimer = null
function startClock() {
  const el = document.getElementById('dash-clock')
  const dEl = document.getElementById('dash-date')
  if (!el) return
  let lastMin = -1
  function tick() {
    const now = new Date()
    const h = String(now.getHours()).padStart(2, '0')
    const m = String(now.getMinutes()).padStart(2, '0')
    const s = String(now.getSeconds()).padStart(2, '0')
    el.innerHTML = `${h}:${m}:<span>${s}</span>`
    if (dEl) { const ds = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }); dEl.textContent = ds.toUpperCase() }
    if (now.getMinutes() !== lastMin) { lastMin = now.getMinutes(); updateCollectionStatus() }
  }
  tick()
  if (_clockTimer) clearInterval(_clockTimer)
  _clockTimer = setInterval(tick, 1000)
}

/* ── META GERAL (barra única) (legacy L5240-5255, verbatim) ── */
function renderGoalBar(d) {
  const metrics = [
    { curr: d.newFollowers, goal: getGoal('followers') },
    { curr: d.eng.likes, goal: getGoal('likes') },
    { curr: d.cnt.postsReels + d.cnt.stories, goal: getGoal('posts-reels') },
  ]
  const valid = metrics.filter(m => m.goal > 0)
  const pct = valid.length > 0
    ? Math.min(100, Math.round(valid.reduce((s, m) => s + Math.min(100, m.curr / m.goal * 100), 0) / valid.length))
    : 0
  const color = pct >= 100 ? '#16a34a' : pct >= 60 ? 'var(--accent)' : '#d97706'
  const fill = document.getElementById('overall-bar-fill')
  const pctEl = document.getElementById('overall-bar-pct')
  if (fill) { fill.style.width = pct + '%'; fill.style.background = color; fill.style.boxShadow = pct >= 100 ? '0 0 7px #16a34a99,0 0 18px #16a34a33' : '' }
  if (pctEl) { pctEl.textContent = pct + '%'; pctEl.style.color = color }
}

/* ── ADMIN PANEL embutido no dashboard (legacy L5524-5579, verbatim).
   ATENÇÃO: toggleAdminPanel() não tem NENHUM gatilho no HTML do legado
   (conferido por grep exaustivo em legacy/index.html: só a própria definição
   e o loadUsers() usam o div #admin-panel) — o painel some no legado
   também, permanentemente escondido. Isso é pré-existente ao port (não foi
   introduzido aqui); ver relatório para detalhes. ── */
let adminPanelOpen = false
function toggleAdminPanel() {
  adminPanelOpen = !adminPanelOpen
  document.getElementById('admin-panel').style.display = adminPanelOpen ? 'block' : 'none'
  if (adminPanelOpen) loadUsers()
}
async function loadUsers() {
  const listEl = document.getElementById('user-list')
  listEl.textContent = ''
  const { data: { session } } = await sbClient.auth.getSession()
  const token = session?.access_token || SUPABASE_ANON_KEY
  const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?order=created_at.asc&select=id,email,name,role`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
  })
  const users = await r.json()
  if (!Array.isArray(users) || users.length === 0) { listEl.innerHTML = '<div style="font-family:\'DM Sanso\',monospace;font-size:11px;color:var(--muted)">Nenhum usuário.</div>'; return }
  users.forEach(u => {
    const row = document.createElement('div'); row.className = 'user-row'
    const info = document.createElement('div'); info.className = 'user-info'
    const emailSpan = document.createElement('span'); emailSpan.className = 'user-email'; emailSpan.textContent = u.email || ''
    const nameSpan = document.createElement('span'); nameSpan.className = 'user-name'; nameSpan.textContent = u.name || '—'
    info.appendChild(emailSpan); info.appendChild(nameSpan)
    const sel = document.createElement('select'); sel.className = 'user-role-select'
    sel.innerHTML = '<option value="viewer"' + (u.role === 'viewer' ? ' selected' : '') + '>Visualizador</option><option value="admin"' + (u.role === 'admin' ? ' selected' : '') + '>Admin</option>'
    sel.addEventListener('change', async () => {
      const { data: { session } } = await sbClient.auth.getSession()
      const tok = session?.access_token || SUPABASE_ANON_KEY
      await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${u.id}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ role: sel.value })
      })
    })
    row.appendChild(info); row.appendChild(sel); listEl.appendChild(row)
  })
}
async function doInvite() {
  const email = document.getElementById('invite-email').value.trim()
  const msgEl = document.getElementById('invite-msg')
  const btn = document.getElementById('invite-btn')
  if (!email) { msgEl.textContent = 'Informe o e-mail.'; msgEl.className = 'admin-msg err'; msgEl.style.display = 'block'; return }
  msgEl.style.display = 'none'; btn.disabled = true; btn.textContent = 'Enviando...'
  const { data: { session } } = await sbClient.auth.getSession()
  const token = session?.access_token || SUPABASE_ANON_KEY
  const redirectTo = location.origin + location.pathname
  const r = await fetch(`${SUPABASE_URL}/functions/v1/invite-user`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, redirectTo })
  })
  const res = await r.json()
  btn.disabled = false; btn.textContent = 'Enviar convite'
  if (res.error) { msgEl.textContent = 'Erro: ' + res.error; msgEl.className = 'admin-msg err'; msgEl.style.display = 'block' }
  else { msgEl.textContent = ''; const t = document.createTextNode('✓ Convite enviado para '); const eb = document.createElement('strong'); eb.textContent = email; msgEl.appendChild(t); msgEl.appendChild(eb); msgEl.className = 'admin-msg ok'; msgEl.style.display = 'block'; document.getElementById('invite-email').value = ''; loadUsers() }
}

/* ── CAMPAIGN FILTER (legacy L5644-5723, verbatim exceto currentSession →
   estado.currentSession em saveNoneCampaigns/saveCampaignFilter) ── */
async function openCampaignModal() {
  if (!currentAccountId) return
  const [campaigns, filterRows] = await Promise.all([
    sb('campaigns?account_id=eq.' + currentAccountId + '&order=status.asc,name.asc&select=campaign_id,name,objective,status'),
    sb('campaign_filters?account_id=eq.' + currentAccountId + '&select=selected_ids'),
  ])
  const rawIds = filterRows[0]?.selected_ids // null=todas, []=nenhuma, [ids]=filtradas
  renderCampaignModal(campaigns, rawIds)
  document.getElementById('campaign-modal-overlay').style.display = 'flex'
}
function renderCampaignModal(campaigns, rawIds) {
  // rawIds: null/undefined=todas marcadas, []=nenhuma marcada, [ids]=só essas marcadas
  const selIds = rawIds === null || rawIds === undefined ? null : new Set(rawIds)
  const list = document.getElementById('campaign-list'); list.innerHTML = ''
  const active = campaigns.filter(c => c.status === 'ACTIVE')
  const other = campaigns.filter(c => c.status !== 'ACTIVE')
  function renderGroup(title, items) {
    if (!items.length) return
    const hdr = document.createElement('div'); hdr.className = 'camp-group-hdr'; hdr.textContent = title; list.appendChild(hdr)
    items.forEach(c => {
      const row = document.createElement('label'); row.className = 'camp-row'
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.value = c.campaign_id
      cb.checked = selIds === null || selIds.has(c.campaign_id)
      const info = document.createElement('div'); info.className = 'camp-info'
      const nm = document.createElement('span'); nm.className = 'camp-name'; nm.textContent = c.name
      const obj = document.createElement('span'); obj.className = 'camp-obj'; obj.textContent = (c.objective || '').replace(/_/g, ' ')
      info.appendChild(nm); info.appendChild(obj); row.appendChild(cb); row.appendChild(info); list.appendChild(row)
      cb.addEventListener('change', updateCampaignCount)
    })
  }
  renderGroup('Ativas', active); renderGroup('Pausadas / Outras', other)
  updateCampaignCount()
}
function updateCampaignCount() {
  const total = document.querySelectorAll('#campaign-list input[type=checkbox]').length
  const checked = document.querySelectorAll('#campaign-list input[type=checkbox]:checked').length
  document.getElementById('camp-count').textContent = checked === total ? '(todas selecionadas)' : '(' + checked + ' de ' + total + ' selecionadas)'
}
async function saveNoneCampaigns() {
  const token = estado.currentSession?.access_token || SUPABASE_ANON_KEY
  await fetch(SUPABASE_URL + '/rest/v1/campaign_filters', {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ account_id: currentAccountId, selected_ids: [], updated_at: new Date().toISOString() }),
  })
  document.getElementById('campaign-modal-overlay').style.display = 'none'
  const info = document.getElementById('camp-filter-info')
  if (info) info.textContent = 'Nenhuma campanha selecionada'
  refresh()
}
async function saveCampaignFilter() {
  const allCbs = [...document.querySelectorAll('#campaign-list input[type=checkbox]')]
  const checked = allCbs.filter(cb => cb.checked).map(cb => cb.value)
  const toSave = checked.length === allCbs.length ? null : checked
  const token = estado.currentSession?.access_token || SUPABASE_ANON_KEY
  await fetch(SUPABASE_URL + '/rest/v1/campaign_filters', {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ account_id: currentAccountId, selected_ids: toSave, updated_at: new Date().toISOString() }),
  })
  document.getElementById('campaign-modal-overlay').style.display = 'none'
  updateCampaignFilterBadge(toSave === null ? allCbs.length : toSave.length, allCbs.length)
  refresh()
}
function updateCampaignFilterBadge(selCount, total) {
  const info = document.getElementById('camp-filter-info')
  if (!info) return
  if (selCount === 0 && total >= 0) info.textContent = 'Nenhuma campanha selecionada'
  else if (selCount === total || total === 0) info.textContent = 'Todas as campanhas (' + total + ')'
  else info.textContent = selCount + ' de ' + total + ' campanhas selecionadas'
}
async function loadCampaignFilterBadge() {
  if (!currentAccountId) return
  const [filterRows, campaigns] = await Promise.all([
    sb('campaign_filters?account_id=eq.' + currentAccountId + '&select=selected_ids'),
    sb('campaigns?account_id=eq.' + currentAccountId + '&select=campaign_id'),
  ])
  const rawIds = filterRows[0]?.selected_ids
  const selCount = rawIds === null || rawIds === undefined ? campaigns.length : rawIds.length
  updateCampaignFilterBadge(selCount, campaigns.length)
}

// Equivalente ao showHome() do legado quando chamado a partir do dashboard
// (que fazia display:none do .wrapper + mostrava a Home do monólito). Além
// de parar todos os timers/listeners que esta tela inicia, navega pelo router.
function _pararTimersDashboard() {
  if (_hojeTimer) { clearInterval(_hojeTimer); _hojeTimer = null }
  if (_clockTimer) { clearInterval(_clockTimer); _clockTimer = null }
  _acStopCycle()
  clearTimeout(_acInactivity); _acInactivity = null
  if (chartOverlayEl) { chartOverlayEl.removeEventListener('mousemove', _onChartMouseMove); chartOverlayEl.removeEventListener('mouseleave', _onChartMouseLeave) }
  document.removeEventListener('mousemove', _acResetInactivity)
  document.removeEventListener('click', _acResetInactivity)
  document.removeEventListener('keydown', _acResetInactivity)
  document.removeEventListener('touchstart', _acResetInactivity)
}
function fecharDashboard() {
  _pararTimersDashboard()
  router.push({ name: 'inicio' })
}

// Cluster de funções chamadas por onclick="..." literal no <template> acima
// (estático) e no modal de campanhas (também estático, dentro da raiz do
// componente) — mesmo padrão da Gestão de Tráfego/Gestão à Vista/Análise de
// Campanhas. Conferido por grep: dentro do HTML gerado em runtime
// (buildProfiles/buildPeriodTabs/renderCampaignModal/loadUsers) NENHUMA
// função é chamada por onclick="..." literal — todas usam addEventListener,
// então não precisam ser expostas em window.
Object.assign(window, {
  onCustomDateChange,
  clearCustomRange,
  setEngTab,
  toggleAutoCycle,
  toggleHeader,
  openFollowersInfo,
  openCampaignModal,
  saveNoneCampaigns,
  saveCampaignFilter,
  updateCampaignCount,
  doInvite,
})

onMounted(async () => {
  if (!hasPermission('tool:social')) {
    adminToast('Sem acesso', false)
    router.push({ name: 'inicio' })
    return
  }
  // Wiring que no legado rodava solto no escopo global do <script> (ver nota
  // no topo do bloco): tooltip do gráfico + detector de inatividade do auto-cycle.
  svgEl = document.getElementById('followers-chart')
  chartOverlayEl = document.getElementById('chart-overlay')
  crosshairEl = document.getElementById('crosshair')
  dotCurrEl = document.getElementById('dot-curr')
  dotPrevEl = document.getElementById('dot-prev')
  tooltipEl = document.getElementById('chart-tooltip')
  chartOverlayEl?.addEventListener('mousemove', _onChartMouseMove)
  chartOverlayEl?.addEventListener('mouseleave', _onChartMouseLeave)
  document.addEventListener('mousemove', _acResetInactivity, { passive: true })
  document.addEventListener('click', _acResetInactivity, { passive: true })
  document.addEventListener('keydown', _acResetInactivity, { passive: true })
  document.addEventListener('touchstart', _acResetInactivity, { passive: true })
  document.addEventListener('click', _onTooltipTap) // tooltip do número inteiro no toque
  // Pipeline de inicialização (mirror de loadDashboard, legacy L5586-5601,
  // menos a parte que já rodou na fundação de login — buscar role/features).
  buildPeriodTabs()
  updateGoalDisplays(currentPeriod)
  watchGoals()
  await buildProfiles()
  restoreHeaderState()
  initAutoCycleToggle()
  startClock()
  await refresh()
})

// CRÍTICO: limpa TODOS os timers/listeners que este dashboard inicia, para
// não deixar nada rodando em segundo plano depois que o usuário sai da rota
// (fecharDashboard cobre o caminho do botão "Central"; isto cobre qualquer
// outra forma de sair, ex.: navegação direto pela URL).
onUnmounted(() => {
  _pararTimersDashboard()
  document.removeEventListener('click', _onTooltipTap)
})
</script>

<style scoped>
/* ── Tooltip universal do número inteiro (fmtN resume; hover no desktop / toque no mobile revela) ── */
.tela-redes-sociais :deep(.tem-tooltip) { position: relative; }
.tela-redes-sociais :deep(.tem-tooltip.mostrar)::after,
.tela-redes-sociais :deep(.tem-tooltip:hover)::after {
  content: attr(data-full);
  position: absolute; left: 50%; bottom: calc(100% + 6px); transform: translateX(-50%);
  background: var(--text); color: var(--surface);
  font-family: 'IBM Plex Sans', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: .3px;
  padding: 4px 8px; border-radius: 6px; white-space: nowrap; z-index: 60; pointer-events: none;
  box-shadow: 0 4px 14px rgba(0,0,0,.22);
}
/* ── Novos seguidores em 3 linhas de FONTE IGUAL (Seguidores / Deixaram de seguir / Total) ── */
.tela-redes-sociais :deep(.nf-linhas){ display:flex; flex-direction:column; gap:6px; margin:4px 0 2px; }
.tela-redes-sociais :deep(.nf-linha){ display:flex; align-items:baseline; justify-content:space-between; gap:12px; }
.tela-redes-sociais :deep(.nf-lbl){ font-family:'IBM Plex Sans',sans-serif; font-size:12px; font-weight:500; color:var(--muted); letter-spacing:.2px; }
.tela-redes-sociais :deep(.nf-val){ font-family:'Oswald',sans-serif; font-size:22px; font-weight:600; color:var(--text); font-variant-numeric:tabular-nums; line-height:1.1; }
.tela-redes-sociais :deep(.nf-val.a-green){ color:#16a34a; }
.tela-redes-sociais :deep(.nf-val.a-red){ color:#ef4444; }
.tela-redes-sociais :deep(.nf-val.a-blue){ color:var(--accent); }
.tela-redes-sociais :deep(.mc-ad-sub){ font-family:'IBM Plex Sans',sans-serif; font-size:10.5px; font-weight:600; color:var(--muted); margin-top:2px; letter-spacing:.2px; }
.tela-redes-sociais :deep(.mc-obs){ font-family:'IBM Plex Sans',sans-serif; font-size:10px; font-weight:500; line-height:1.35; color:var(--muted); opacity:.85; margin-top:4px; }
/* Porte das regras do dashboard central de Redes Sociais (legacy/index.html,
   principalmente L34-386/389-470/683-709/815-870 — hoje ainda em
   src/estilos/estilos-globais.css, de onde NÃO foram removidas: ao contrário
   da Gestão à Vista/Análise de Campanhas (que puderam "arrancar" seus
   seletores gv- e ma- do global porque eram exclusivos delas), boa parte
   destas regras (.mc-*, .card, .topbar*, .sec*, .profile-*, .ac-toggle*,
   #apb-*, .insight-*, .overall-bar-*, #dash-clock, .chart-*, .calc-badge,
   .rbv-logo, .live-dot, .gv-back/.gv-perf-tag/.gv-brand-tag/.gv-clock-date/
   .gv-update-status, .custom-range-btn/.custom-date-input,
   .admin-input/.admin-select/.admin-action-btn/.admin-msg/.user-list/
   .auth-label) são compartilhadas com telas AINDA não migradas (Vendas,
   Meta Ads, Admin) e com o tela-de-login.vue já migrado — removê-las do
   global quebraria essas outras telas. Por isso: cópia própria aqui (mesmo
   padrão de sempre — cada tela traz a sua), SEM tocar em
   estilos-globais.css. Isso é uma escolha deliberada de segurança, não uma
   omissão — ver "CONCERNS" no relatório (.superpowers/sdd/social-port-
   report.md) para a lista exata do que ficou como candidato a uma limpeza
   futura, quando todas as telas restantes estiverem portadas.
   .wrapper vira a raiz .tela-redes-sociais (sem display:none — a
   visibilidade é do router). #period-tabs, #profile-select, #chips-*,
   #admin-panel > #user-list e o board de métricas inteiro são preenchidos
   via getElementById/createElement/innerHTML (JS imperativo acima), por
   isso os seletores usam :deep(). #chart-tooltip/#campaign-modal-overlay/
   #autocycle-progress são irmãos soltos no <body> no legado — aqui vivem
   dentro da raiz do componente (position:fixed não muda o layout) só para
   o :deep() alcançá-los, mesma técnica dos modais da Gestão de Tráfego. */
.tela-redes-sociais{min-height:100vh;position:relative;z-index:1;}

.tela-redes-sociais :deep(.wrapper){max-width:1200px;margin:0 auto;padding:16px 24px;position:relative;z-index:1;transition:opacity .08s ease;}
.tela-redes-sociais :deep(.wrapper.fading){opacity:.4;}
.tela-redes-sociais :deep(.wrapper.entering){animation:profileEnter .28s cubic-bezier(.22,1,.36,1) both;}
.tela-redes-sociais :deep(#autocycle-progress){display:none!important;}

/* Header / seletor de perfil */
.tela-redes-sociais :deep(header){display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:16px;padding-bottom:0;}
.tela-redes-sociais :deep(#header-collapsible){display:flex;align-items:center;gap:16px;flex-wrap:wrap;overflow:hidden;max-height:120px;opacity:1;transition:max-height .35s ease,opacity .25s ease;}
.tela-redes-sociais :deep(#header-collapsible.collapsed){max-height:0;opacity:0;pointer-events:none;}
.tela-redes-sociais :deep(#header-toggle){background:none;border:1px solid var(--border);cursor:pointer;color:var(--muted);font-size:11px;padding:5px 10px;border-radius:3px;font-family:'IBM Plex Sans',sans-serif;display:flex;align-items:center;gap:5px;transition:border-color .18s,color .18s;white-space:nowrap;align-self:flex-start;}
.tela-redes-sociais :deep(#header-toggle:hover){border-color:var(--accent);color:var(--accent);}
.tela-redes-sociais :deep(#header-toggle .ht-arrow){display:inline-block;transition:transform .35s ease;font-size:9px;line-height:1;}
.tela-redes-sociais :deep(.profile-select){display:flex;gap:6px;flex-wrap:wrap;}
.tela-redes-sociais :deep(.profile-btn){background:var(--surface);border:1px solid var(--border);color:var(--muted);padding:7px 14px;border-radius:var(--radius-sm);font-family:'IBM Plex Sans',sans-serif;font-size:12px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:8px;transition:background .2s cubic-bezier(.4,0,.2,1),border-color .2s ease,color .15s ease,transform .12s ease;}
.tela-redes-sociais :deep(.profile-btn:active){transform:scale(.95);}
.tela-redes-sociais :deep(.profile-btn:focus-visible){outline:2px solid var(--accent);outline-offset:2px;}
.tela-redes-sociais :deep(.profile-btn .av){width:20px;height:20px;border-radius:50%;font-size:9px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;overflow:hidden;flex-shrink:0;position:relative;z-index:1;}
.tela-redes-sociais :deep(.profile-btn .av img){width:100%;height:100%;object-fit:cover;border-radius:50%;}
.tela-redes-sociais :deep(.av-ring-wrap){position:relative;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.tela-redes-sociais :deep(.av-ring-wrap)::before{content:'';position:absolute;inset:-2.5px;border-radius:50%;background:conic-gradient(#f09433,#e6683c,#dc2743,#cc2366,#bc1888,#833ab4,#405de6,#f09433);animation:storiesRotate 3s linear infinite;opacity:0;transition:opacity .3s;}
.tela-redes-sociais :deep(.av-ring-wrap.has-stories)::before{opacity:1;}
.tela-redes-sociais :deep(.av-ring-wrap.has-stories>.av){outline:1.5px solid var(--bg);outline-offset:0;}
.tela-redes-sociais :deep(#apb-ring-wrap){position:relative;display:none;flex-shrink:0;}
.tela-redes-sociais :deep(#apb-ring-wrap)::before{content:'';position:absolute;inset:-4px;border-radius:50%;background:conic-gradient(#f09433,#e6683c,#dc2743,#cc2366,#bc1888,#833ab4,#405de6,#f09433);animation:storiesRotate 3s linear infinite;opacity:0;transition:opacity .3s;}
.tela-redes-sociais :deep(#apb-ring-wrap.has-stories)::before{opacity:1;}
.tela-redes-sociais :deep(#apb-img){width:44px;height:44px;border-radius:50%;object-fit:cover;flex-shrink:0;border:none;display:block;position:relative;z-index:1;}
.tela-redes-sociais :deep(#apb-ring-wrap.has-stories #apb-img){outline:2.5px solid var(--bg);outline-offset:0;}
.tela-redes-sociais :deep(.profile-btn.active){background:var(--accent);border-color:var(--accent);color:#fff;}
.tela-redes-sociais :deep(.profile-btn:hover:not(.active)){border-color:var(--accent);color:var(--text);background:var(--accent-light);}

/* Topbar */
.tela-redes-sociais :deep(.topbar){display:flex;align-items:center;justify-content:space-between;padding-bottom:6px;margin-bottom:6px;flex-wrap:nowrap;gap:10px;}
.tela-redes-sociais :deep(.topbar-left){display:flex;align-items:center;gap:14px;min-width:0;flex-shrink:1;}
.tela-redes-sociais :deep(.topbar-center){display:flex;align-items:center;gap:8px;flex-wrap:nowrap;flex:1 1 auto;min-width:0;justify-content:center;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;}
.tela-redes-sociais :deep(.topbar-center)::-webkit-scrollbar{display:none;}
.tela-redes-sociais :deep(.topbar-right){display:flex;align-items:center;gap:12px;text-align:right;flex-shrink:0;}
.tela-redes-sociais :deep(.period-tabs){display:flex;gap:4px;flex-wrap:nowrap;flex-shrink:0;}
.tela-redes-sociais :deep(.ptab){padding:4px 9px;border-radius:var(--radius-sm);font-family:'IBM Plex Sans',sans-serif;font-size:10px;font-weight:600;cursor:pointer;color:var(--muted);border:1px solid var(--border);background:none;letter-spacing:.5px;text-transform:uppercase;white-space:nowrap;flex-shrink:0;transition:background .2s cubic-bezier(.4,0,.2,1),color .15s ease,border-color .15s ease,transform .12s ease,box-shadow .2s ease;}
.tela-redes-sociais :deep(.ptab):active{transform:scale(.94);}
.tela-redes-sociais :deep(.ptab.active){background:var(--accent);color:#fff;border-color:var(--accent);box-shadow:0 2px 8px rgba(29,78,216,.25);}
[data-theme="dark"] .tela-redes-sociais :deep(.ptab.active){box-shadow:0 2px 10px rgba(79,124,255,.35);}
.tela-redes-sociais :deep(.ptab):focus-visible{outline:2px solid var(--accent);outline-offset:2px;}

/* Relógio / live-dot / logo — compartilhados com outras telas (cópia própria, ver nota acima) */
.tela-redes-sociais :deep(.live-dot){display:inline-flex;align-items:center;gap:6px;font-family:'IBM Plex Sans',sans-serif;font-size:9px;color:var(--green);letter-spacing:1.5px;font-weight:500;text-transform:uppercase;}
.tela-redes-sociais :deep(.live-dot)::before{content:'';width:5px;height:5px;border-radius:50%;background:var(--green);animation:pulse 2s infinite;}
.tela-redes-sociais :deep(.rbv-logo){height:52px;width:auto;object-fit:contain;display:block;}
.tela-redes-sociais :deep(.rbv-logo-dark){display:none;}
[data-theme="dark"] .tela-redes-sociais :deep(.rbv-logo-light){display:none;}
[data-theme="dark"] .tela-redes-sociais :deep(.rbv-logo-dark){display:block;}
.tela-redes-sociais :deep(.gv-back){display:flex;align-items:center;gap:4px;font-family:'IBM Plex Sans',sans-serif;font-size:10px;font-weight:600;color:var(--accent);cursor:pointer;background:none;border:none;padding:0;transition:opacity .15s;letter-spacing:.3px;text-transform:uppercase;}
.tela-redes-sociais :deep(.gv-back):hover{opacity:.75;}
.tela-redes-sociais :deep(.gv-perf-tag){font-family:'IBM Plex Sans',sans-serif;font-size:13.5px;font-weight:700;letter-spacing:6px;text-transform:uppercase;color:var(--text);opacity:1;line-height:1.2;}
.tela-redes-sociais :deep(.gv-brand-tag){font-family:'IBM Plex Sans',sans-serif;font-size:10px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:var(--text);opacity:.6;line-height:1;}
.tela-redes-sociais :deep(.gv-clock-date){font-family:'IBM Plex Sans',sans-serif;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-top:3px;}
.tela-redes-sociais :deep(.gv-update-status){font-family:'IBM Plex Sans',sans-serif;font-size:8px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);opacity:.45;margin-top:4px;text-align:right;}
.tela-redes-sociais :deep(#dash-clock){font-family:'Oswald',sans-serif;font-size:15px;font-weight:400;letter-spacing:2px;color:var(--muted);white-space:nowrap;line-height:1;}
.tela-redes-sociais :deep(#dash-clock span){color:var(--accent);font-weight:500;}

/* Active profile bar */
.tela-redes-sociais :deep(#active-profile-bar){display:flex;align-items:center;gap:9px;margin-bottom:14px;}
.tela-redes-sociais :deep(#apb-dot){width:8px;height:8px;border-radius:50%;background:var(--accent);flex-shrink:0;transition:background .4s ease;}
.tela-redes-sociais :deep(#apb-name){font-family:'Oswald',sans-serif;font-size:22px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:var(--text);}

/* Auto-cycle toggle (dashboard-específico) */
.tela-redes-sociais :deep(.ac-toggle){display:inline-flex;align-items:center;gap:7px;cursor:pointer;user-select:none;}
.tela-redes-sociais :deep(.ac-toggle-track){width:34px;height:19px;border-radius:10px;background:var(--border);position:relative;flex-shrink:0;transition:background .25s ease;border:1px solid rgba(0,0,0,.08);}
.tela-redes-sociais :deep(.ac-toggle-track.on){background:var(--accent);}
.tela-redes-sociais :deep(.ac-toggle-thumb){position:absolute;top:2px;left:2px;width:13px;height:13px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .25s cubic-bezier(.34,1.56,.64,1);}
.tela-redes-sociais :deep(.ac-toggle-track.on .ac-toggle-thumb){transform:translateX(15px);}
.tela-redes-sociais :deep(.ac-toggle-lbl){font-family:'IBM Plex Sans',sans-serif;font-size:10px;font-weight:600;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;transition:color .2s;}
.tela-redes-sociais :deep(.ac-toggle.on .ac-toggle-lbl){color:var(--accent);}
.tela-redes-sociais :deep(#autocycle-badge){position:fixed;bottom:18px;right:18px;display:none;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:7px 14px;font-family:'IBM Plex Sans',sans-serif;font-size:11px;color:var(--text);letter-spacing:.8px;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.15);}
.tela-redes-sociais :deep(#autocycle-badge .ac-dot){width:6px;height:6px;border-radius:50%;background:var(--green);animation:pulse 2s infinite;flex-shrink:0;}

/* Section headers / grids / cards */
.tela-redes-sociais :deep(.sec-header){display:flex;align-items:center;gap:12px;margin-bottom:8px;}
.tela-redes-sociais :deep(.section-label){font-family:'IBM Plex Sans',sans-serif;font-weight:600;font-size:11px;letter-spacing:2px;color:var(--muted);text-transform:uppercase;white-space:nowrap;}
.tela-redes-sociais :deep(.sec-line){flex:1;height:1px;background:var(--border);}
.tela-redes-sociais :deep(.sec-chips){display:flex;gap:6px;flex-wrap:wrap;}
.tela-redes-sociais :deep(.sec-chip){font-family:'IBM Plex Sans',sans-serif;font-weight:500;font-size:10px;padding:3px 8px;border-radius:var(--radius-sm);background:var(--surface2);color:var(--muted);border:1px solid var(--border);white-space:nowrap;letter-spacing:.3px;}
.tela-redes-sociais :deep(.mb40){margin-bottom:22px;}
.tela-redes-sociais :deep(.card){background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:22px 24px;border-left:3px solid transparent;animation:fadeUp .55s cubic-bezier(.22,1,.36,1) both;transition:border-color .22s,box-shadow .22s;will-change:transform,opacity;cursor:default;}
.tela-redes-sociais :deep(.card):hover{border-left-color:var(--accent);border-color:var(--accent-mid);box-shadow:var(--shadow-md);}
[data-theme="dark"] .tela-redes-sociais :deep(.card){box-shadow:none;}

/* Metric card */
.tela-redes-sociais :deep(.mc-header){display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;}
.tela-redes-sociais :deep(.mc-icon){font-size:16px;opacity:.35;}
.tela-redes-sociais :deep(.mc-goal-area){display:flex;align-items:center;gap:5px;}
.tela-redes-sociais :deep(.mc-goal-lbl){font-family:'IBM Plex Sans',sans-serif;font-weight:600;font-size:10px;letter-spacing:1px;color:var(--muted);text-transform:uppercase;}
.tela-redes-sociais :deep(.mc-goal-val){font-family:'IBM Plex Sans',sans-serif;font-weight:500;font-size:12px;color:var(--text);border-bottom:1px dashed rgba(0,0,0,.15);cursor:text;outline:none;background:transparent;min-width:20px;text-align:right;}
.tela-redes-sociais :deep(.mc-goal-val):focus{border-color:var(--accent);color:var(--accent);}
.tela-redes-sociais :deep(.mc-edit-hint){font-size:9px;color:var(--muted);opacity:.35;transition:opacity .2s;}
.tela-redes-sociais :deep(.mc-goal-val:focus+.mc-edit-hint),.tela-redes-sociais :deep(.mc-edit-hint):hover{opacity:1;}
.tela-redes-sociais :deep(.mc-lbl){font-family:'IBM Plex Sans',sans-serif;font-weight:600;font-size:11px;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;margin-bottom:5px;}
.tela-redes-sociais :deep(.mc-val){font-family:'Oswald',sans-serif;font-size:44px;font-weight:500;line-height:1;margin-bottom:8px;color:var(--text);font-variant-numeric:tabular-nums;}
.tela-redes-sociais :deep(.mc-compare){display:flex;flex-direction:column;gap:4px;margin-bottom:12px;padding:7px 10px;background:var(--surface2);border-radius:var(--radius-sm);border:1px solid var(--border);}
.tela-redes-sociais :deep(.mc-compare-label){font-family:'IBM Plex Sans',sans-serif;font-weight:500;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;overflow-wrap:break-word;word-break:break-word;line-height:1.3;}
.tela-redes-sociais :deep(.mc-compare-vals){display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;}
.tela-redes-sociais :deep(.mc-compare-prev){font-family:'IBM Plex Sans',sans-serif;font-weight:400;font-size:12px;color:var(--muted);}
.tela-redes-sociais :deep(.mc-compare-delta){font-family:'IBM Plex Sans',sans-serif;font-size:12px;font-weight:600;white-space:nowrap;}
.tela-redes-sociais :deep(.mc-divider){height:1px;background:var(--border);margin-bottom:10px;}
.tela-redes-sociais :deep(.mc-progress-track){height:2px;border-radius:0;background:var(--surface2);overflow:hidden;margin-bottom:7px;}
.tela-redes-sociais :deep(.mc-progress-fill){height:100%;border-radius:0;transition:width .8s cubic-bezier(.34,1.56,.64,1),background .4s,box-shadow .5s;position:relative;overflow:hidden;}
.tela-redes-sociais :deep(.mc-progress-fill)::after{content:'';position:absolute;top:0;left:-60%;width:55%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.42),transparent);animation:barLiq 2.2s ease-in-out infinite;pointer-events:none;}
.tela-redes-sociais :deep(.mc-progress-fill.bg-green){box-shadow:0 0 7px #22c55e99,0 0 18px #22c55e33;}
[data-theme="light"] .tela-redes-sociais :deep(.mc-progress-fill.bg-green){box-shadow:0 0 5px #1a6e4566;}
.tela-redes-sociais :deep(.mc-bottom){display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px;}
.tela-redes-sociais :deep(.mc-pct){font-family:'Oswald',sans-serif;font-size:15px;font-weight:400;color:var(--muted);}
.tela-redes-sociais :deep(.mc-diff){font-family:'IBM Plex Sans',sans-serif;font-size:10px;font-weight:500;}

/* Colors */
.tela-redes-sociais :deep(.c-green){color:var(--green)!important;}
.tela-redes-sociais :deep(.c-yellow){color:var(--yellow)!important;}
.tela-redes-sociais :deep(.c-orange){color:var(--orange)!important;}
.tela-redes-sociais :deep(.c-red){color:var(--red)!important;}
.tela-redes-sociais :deep(.bg-green){background:var(--green)!important;}
.tela-redes-sociais :deep(.bg-yellow){background:var(--yellow)!important;}
.tela-redes-sociais :deep(.bg-orange){background:var(--orange)!important;}
.tela-redes-sociais :deep(.bg-red){background:var(--red)!important;}
.tela-redes-sociais :deep(.a-orange),.tela-redes-sociais :deep(.a-pink),.tela-redes-sociais :deep(.a-purple),.tela-redes-sociais :deep(.a-blue){color:var(--accent)!important;-webkit-text-fill-color:var(--accent)!important;background:none!important;}

/* Grids */
.tela-redes-sociais :deep(.sec1-grid){display:grid;grid-template-columns:280px 1fr;gap:16px;}
.tela-redes-sociais :deep(.sec2-grid){display:grid;grid-template-columns:1fr 1fr;gap:16px;}
.tela-redes-sociais :deep(.sec3-grid){display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}
.tela-redes-sociais :deep(.sec4-grid){display:grid;grid-template-columns:repeat(2,1fr);gap:16px;}

/* Chart */
.tela-redes-sociais :deep(.chart-svg-wrap){position:relative;width:100%;}
.tela-redes-sociais :deep(.chart-svg-wrap) svg{width:100%;height:120px;overflow:visible;cursor:crosshair;}
.tela-redes-sociais :deep(#chart-data-labels){position:absolute;top:0;left:0;width:100%;height:120px;pointer-events:none;overflow:visible;}
.tela-redes-sociais :deep(.cdl){position:absolute;transform:translate(-50%,calc(-100% - 3px));font-family:'Oswald',sans-serif;font-size:14px;font-weight:500;color:rgba(22,22,42,0.65);white-space:nowrap;letter-spacing:.3px;}
[data-theme="dark"] .tela-redes-sociais :deep(.cdl){color:rgba(226,228,240,0.78);}
.tela-redes-sociais :deep(.cdl-in){position:absolute;font-family:'IBM Plex Sans',sans-serif;font-size:10px;font-weight:700;color:#fff;white-space:nowrap;pointer-events:none;text-shadow:0 1px 2px rgba(0,0,0,.28);}
.tela-redes-sociais :deep(.cdl-sm){font-size:10px;letter-spacing:0;}
.tela-redes-sociais :deep(.cdl-hi){transform:translate(-50%,calc(-100% - 22px));}
.tela-redes-sociais :deep(.cdl-hi)::after{content:'';position:absolute;left:50%;top:100%;width:0;height:20px;border-left:1px dashed currentColor;opacity:.4;}
.tela-redes-sociais :deep(.cdl-up){color:#16a34a;}
.tela-redes-sociais :deep(.cdl-down){color:#dc2626;}
[data-theme="dark"] .tela-redes-sociais :deep(.cdl-up){color:#4ade80;}
[data-theme="dark"] .tela-redes-sociais :deep(.cdl-down){color:#f87171;}
.tela-redes-sociais :deep(.chart-legend){display:flex;gap:16px;margin-top:8px;margin-bottom:4px;}
.tela-redes-sociais :deep(.legend-item){display:flex;align-items:center;gap:5px;font-family:'Oswald',sans-serif;font-size:10px;font-weight:400;color:var(--muted);letter-spacing:.5px;}
.tela-redes-sociais :deep(.legend-line){width:20px;height:2px;border-radius:0;}
.tela-redes-sociais :deep(.legend-dot){width:9px;height:9px;border-radius:2px;}
.tela-redes-sociais :deep(.legend-dash){width:20px;height:2px;background:repeating-linear-gradient(90deg,rgba(0,0,0,.2)0,rgba(0,0,0,.2)4px,transparent 4px,transparent 7px);}
.tela-redes-sociais :deep(.x-labels){position:relative;height:16px;overflow:visible;}
.tela-redes-sociais :deep(.x-label){position:absolute;transform:translateX(-50%);font-family:'Oswald',sans-serif;font-weight:400;font-size:9px;color:var(--muted);white-space:nowrap;letter-spacing:.3px;}

/* Tooltip flutuante do gráfico */
.tela-redes-sociais :deep(#chart-tooltip){position:fixed;pointer-events:none;z-index:999;display:none;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px 14px;min-width:180px;box-shadow:var(--shadow-tooltip);}
.tela-redes-sociais :deep(.tt-date){font-family:'Oswald',sans-serif;font-size:9px;font-weight:400;color:var(--muted);margin-bottom:8px;letter-spacing:1.5px;text-transform:uppercase;}
.tela-redes-sociais :deep(.tt-row){display:flex;align-items:center;gap:8px;margin-bottom:4px;}
.tela-redes-sociais :deep(.tt-dot){width:7px;height:7px;border-radius:50%;flex-shrink:0;}
.tela-redes-sociais :deep(.tt-dot.curr){background:var(--accent);}
.tela-redes-sociais :deep(.tt-dot.prev){background:rgba(0,0,0,.2);}
.tela-redes-sociais :deep(.tt-label){font-family:'Oswald',sans-serif;font-size:11px;font-weight:400;color:var(--muted);flex:1;letter-spacing:.5px;}
.tela-redes-sociais :deep(.tt-val){font-family:'Oswald',sans-serif;font-weight:500;font-size:17px;color:var(--text);font-variant-numeric:tabular-nums;}
.tela-redes-sociais :deep(.tt-sep){height:1px;background:var(--border);margin:6px 0;}
.tela-redes-sociais :deep(.tt-delta){font-family:'Oswald',sans-serif;font-size:11px;font-weight:400;margin-top:4px;}

/* Calc badge / seletor de período personalizado (compartilhado com Análise de Campanhas) */
.tela-redes-sociais :deep(.calc-badge){display:inline-flex;align-items:center;gap:5px;font-family:'IBM Plex Sans',sans-serif;font-size:10px;background:var(--accent-light);color:var(--accent);padding:3px 10px;border-radius:2px;margin-top:8px;font-weight:500;letter-spacing:.3px;}
.tela-redes-sociais :deep(.custom-range-btn){font-family:'IBM Plex Sans',sans-serif;font-weight:500;font-size:11px;padding:5px 14px;border-radius:3px;background:var(--surface2);border:1px solid var(--border);color:var(--muted);cursor:pointer;transition:all .18s;white-space:nowrap;}
.tela-redes-sociais :deep(.custom-range-btn):hover,.tela-redes-sociais :deep(.custom-range-btn.active){border-color:var(--accent);color:var(--accent);}
.tela-redes-sociais :deep(.custom-date-input){font-family:'IBM Plex Sans',sans-serif;font-weight:400;font-size:11px;padding:5px 10px;border-radius:3px;border:1.5px solid var(--border);background:var(--surface);color:var(--text);outline:none;cursor:pointer;}
.tela-redes-sociais :deep(.custom-date-input):hover,.tela-redes-sociais :deep(.custom-date-input):focus{border-color:var(--accent);}
.tela-redes-sociais :deep(.custom-range-inline){display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
.tela-redes-sociais :deep(.custom-range-lbl){font-family:'DM Sans',sans-serif;font-size:11px;color:var(--muted);}
.tela-redes-sociais :deep(.eng-tabs){display:inline-flex;gap:4px;flex-wrap:wrap;margin-bottom:22px;padding:4px;background:var(--surface2);border:1px solid var(--border);border-radius:12px;}
.tela-redes-sociais :deep(.eng-tab){font-family:'IBM Plex Sans',sans-serif;font-weight:600;font-size:11.5px;letter-spacing:.2px;padding:7px 18px;border-radius:9px;background:transparent;border:none;color:var(--muted);cursor:pointer;transition:all .16s;white-space:nowrap;}
.tela-redes-sociais :deep(.eng-tab):hover{color:var(--text);background:rgba(128,128,128,.10);}
.tela-redes-sociais :deep(.eng-tab.active){background:var(--accent);color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.14);}
.tela-redes-sociais :deep(.eng-tab.active):hover{background:var(--accent);color:#fff;}
.tela-redes-sociais :deep(.custom-date-input):focus{border-color:var(--accent);}
.tela-redes-sociais :deep(.custom-apply-btn){font-family:'IBM Plex Sans',sans-serif;font-weight:600;font-size:11px;padding:5px 14px;border-radius:3px;background:var(--accent);color:#fff;border:none;cursor:pointer;letter-spacing:.5px;text-transform:uppercase;}
.tela-redes-sociais :deep(.custom-clear-btn){font-family:'IBM Plex Sans',sans-serif;font-size:11px;padding:5px 10px;border-radius:3px;background:var(--surface2);border:1px solid var(--border);color:var(--muted);cursor:pointer;}

/* Insight card + barra de meta geral */
.tela-redes-sociais :deep(.insight-card){background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:10px 16px 12px;margin-bottom:22px;border-left:3px solid var(--accent);}
.tela-redes-sociais :deep(.insight-header){display:flex;align-items:center;gap:8px;margin-bottom:7px;}
.tela-redes-sociais :deep(.insight-icon){font-size:11px;opacity:.5;}
.tela-redes-sociais :deep(.insight-title){font-family:'IBM Plex Sans',sans-serif;font-weight:600;font-size:9px;letter-spacing:2px;color:var(--muted);text-transform:uppercase;}
.tela-redes-sociais :deep(.insight-period){font-family:'IBM Plex Sans',sans-serif;font-size:9px;font-weight:600;letter-spacing:1.5px;color:var(--accent);text-transform:uppercase;margin-left:auto;background:var(--accent-light);padding:2px 7px;border-radius:2px;}
.tela-redes-sociais :deep(.insight-list){display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;}
.tela-redes-sociais :deep(.insight-item){display:inline-flex;align-items:center;gap:6px;font-family:'IBM Plex Sans',sans-serif;font-size:11px;line-height:1.4;color:var(--text);background:var(--surface2);border:1px solid var(--border);border-radius:20px;padding:3px 10px;}
.tela-redes-sociais :deep(.insight-dot){width:5px;height:5px;border-radius:50%;flex-shrink:0;}
.tela-redes-sociais :deep(.insight-dot.green){background:#16a34a;}
.tela-redes-sociais :deep(.insight-dot.blue){background:var(--accent);}
.tela-redes-sociais :deep(.insight-dot.yellow){background:#d97706;}
.tela-redes-sociais :deep(.insight-dot.red){background:#dc2626;}
.tela-redes-sociais :deep(.insight-dot.muted){background:var(--border);}
.tela-redes-sociais :deep(.insight-item.muted){color:var(--muted);}
.tela-redes-sociais :deep(.overall-bar-row){display:flex;align-items:center;gap:10px;}
.tela-redes-sociais :deep(.overall-bar-lbl){font-family:'IBM Plex Sans',sans-serif;font-size:9px;font-weight:600;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;white-space:nowrap;}
.tela-redes-sociais :deep(.overall-bar-track){flex:1;height:4px;background:var(--surface2);border-radius:2px;overflow:hidden;border:1px solid var(--border);}
.tela-redes-sociais :deep(.overall-bar-fill){height:100%;border-radius:2px;transition:width .9s cubic-bezier(.4,0,.2,1),box-shadow .5s;position:relative;overflow:hidden;}
.tela-redes-sociais :deep(.overall-bar-fill)::after{content:'';position:absolute;top:0;left:-60%;width:55%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent);animation:barLiq 2.2s ease-in-out infinite;pointer-events:none;}
.tela-redes-sociais :deep(.overall-bar-pct){font-family:'Oswald',sans-serif;font-size:13px;font-weight:500;white-space:nowrap;}
.tela-redes-sociais :deep(#insight-card.loading .insight-list){opacity:.4;}

/* Filtro de campanhas — barra + modal (exclusivo desta tela) */
.tela-redes-sociais :deep(.camp-filter-bar){display:flex;align-items:center;gap:10px;background:var(--accent-light);border:1px solid var(--accent-mid);border-radius:4px;padding:9px 14px;margin-bottom:14px;flex-wrap:wrap;}
.tela-redes-sociais :deep(.camp-filter-lbl){font-family:'IBM Plex Sans',sans-serif;font-size:10px;font-weight:500;color:var(--muted);white-space:nowrap;text-transform:uppercase;letter-spacing:.8px;}
.tela-redes-sociais :deep(.camp-filter-info){font-family:'IBM Plex Sans',sans-serif;font-size:12px;font-weight:600;color:var(--accent);flex:1;}
.tela-redes-sociais :deep(.btn-campaign-filter){font-family:'IBM Plex Sans',sans-serif;font-size:10px;font-weight:600;padding:5px 14px;border-radius:3px;border:1px solid var(--accent);background:var(--accent);color:#fff;cursor:pointer;letter-spacing:.8px;transition:opacity .15s;white-space:nowrap;text-transform:uppercase;}
.tela-redes-sociais :deep(.btn-campaign-filter):hover{opacity:.85;}
.tela-redes-sociais :deep(.camp-filter-count){font-size:10px;opacity:.8;}
.tela-redes-sociais :deep(.campaign-modal){background:#fff;border-radius:4px;width:500px;max-width:95vw;max-height:82vh;display:flex;flex-direction:column;box-shadow:0 16px 48px rgba(0,0,0,.18);}
.tela-redes-sociais :deep(.camp-modal-hdr){display:flex;align-items:center;justify-content:space-between;padding:18px 20px 10px;font-family:'IBM Plex Sans',sans-serif;font-weight:700;font-size:14px;color:var(--text);}
.tela-redes-sociais :deep(.camp-modal-close){background:none;border:none;font-size:18px;cursor:pointer;color:#aaa;line-height:1;padding:2px 6px;border-radius:3px;transition:background .1s;}
.tela-redes-sociais :deep(.camp-modal-close):hover{background:var(--surface2);}
.tela-redes-sociais :deep(.camp-modal-sub){padding:0 20px 12px;font-family:'IBM Plex Sans',sans-serif;font-size:12px;color:var(--muted);line-height:1.5;}
.tela-redes-sociais :deep(.camp-list){flex:1;overflow-y:auto;padding:0 12px 8px;display:flex;flex-direction:column;gap:2px;}
.tela-redes-sociais :deep(.camp-group-hdr){font-family:'IBM Plex Sans',sans-serif;font-size:9px;font-weight:700;letter-spacing:2px;color:#aaa;text-transform:uppercase;padding:10px 8px 4px;margin-top:4px;}
.tela-redes-sociais :deep(.camp-row){display:flex;align-items:flex-start;gap:10px;padding:8px 10px;border-radius:3px;cursor:pointer;transition:background .1s;}
.tela-redes-sociais :deep(.camp-row):hover{background:var(--surface2);}
.tela-redes-sociais :deep(.camp-row) input[type=checkbox]{margin-top:2px;accent-color:var(--accent);width:15px;height:15px;flex-shrink:0;cursor:pointer;}
.tela-redes-sociais :deep(.camp-info){display:flex;flex-direction:column;gap:1px;}
.tela-redes-sociais :deep(.camp-name){font-family:'IBM Plex Sans',sans-serif;font-size:13px;font-weight:400;color:var(--text);line-height:1.4;}
.tela-redes-sociais :deep(.camp-obj){font-family:'IBM Plex Sans',sans-serif;font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:.8px;}
.tela-redes-sociais :deep(.camp-modal-footer){display:flex;gap:10px;padding:14px 20px;border-top:1px solid var(--border);}
.tela-redes-sociais :deep(.btn-camp-all){flex:1;font-family:'IBM Plex Sans',sans-serif;font-size:11px;font-weight:500;padding:9px 14px;border-radius:3px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;transition:background .1s;letter-spacing:.5px;}
.tela-redes-sociais :deep(.btn-camp-all):hover{background:var(--surface2);}
.tela-redes-sociais :deep(.btn-camp-none){font-family:'IBM Plex Sans',sans-serif;font-size:11px;font-weight:500;padding:9px 14px;border-radius:3px;border:1px solid rgba(176,30,58,.3);background:transparent;color:var(--red);cursor:pointer;transition:background .1s;}
.tela-redes-sociais :deep(.btn-camp-none):hover{background:rgba(176,30,58,.04);}
.tela-redes-sociais :deep(.btn-camp-save){flex:2;font-family:'IBM Plex Sans',sans-serif;font-size:12px;font-weight:600;padding:9px 20px;border-radius:3px;border:none;background:var(--accent);color:#fff;cursor:pointer;transition:opacity .15s;text-transform:uppercase;letter-spacing:.8px;}
.tela-redes-sociais :deep(.btn-camp-save):hover{opacity:.88;}

/* Painel admin embutido (compartilhado com tela-de-login/Admin tool p/ .admin-input/
   .admin-select/.admin-action-btn/.admin-msg/.user-list/.auth-label — cópia própria) */
.tela-redes-sociais :deep(#admin-panel){background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:28px;margin-bottom:32px;animation:fadeUp .3s ease;}
.tela-redes-sociais :deep(.admin-title){font-family:'Oswald',sans-serif;font-size:20px;font-weight:500;letter-spacing:3px;text-transform:uppercase;margin-bottom:20px;display:flex;align-items:center;gap:10px;color:var(--text);}
.tela-redes-sociais :deep(.admin-grid){display:grid;grid-template-columns:1fr 1fr;gap:20px;}
@media(max-width:640px){.tela-redes-sociais :deep(.admin-grid){grid-template-columns:1fr;}}
.tela-redes-sociais :deep(.admin-section-title){font-family:'IBM Plex Sans',sans-serif;font-size:9px;letter-spacing:2px;color:var(--muted);text-transform:uppercase;margin-bottom:12px;font-weight:600;}
.tela-redes-sociais :deep(.admin-input-row){display:flex;gap:8px;margin-bottom:10px;}
.tela-redes-sociais :deep(.admin-input){flex:1;padding:9px 12px;background:var(--surface2);border:1.5px solid var(--border);border-radius:3px;color:var(--text);font-family:'IBM Plex Sans',sans-serif;font-size:13px;outline:none;transition:border-color .18s;}
.tela-redes-sociais :deep(.admin-input):focus{border-color:var(--accent);}
.tela-redes-sociais :deep(.admin-select){padding:9px 12px;background:var(--surface2);border:1.5px solid var(--border);border-radius:3px;color:var(--text);font-family:'IBM Plex Sans',sans-serif;font-size:12px;outline:none;cursor:pointer;}
.tela-redes-sociais :deep(.admin-action-btn){padding:9px 16px;background:var(--accent);color:#fff;border:none;border-radius:3px;font-family:'IBM Plex Sans',sans-serif;font-size:11px;cursor:pointer;white-space:nowrap;transition:opacity .18s;font-weight:600;text-transform:uppercase;letter-spacing:.8px;}
.tela-redes-sociais :deep(.admin-action-btn):hover{opacity:.85;}
.tela-redes-sociais :deep(.admin-action-btn):disabled{opacity:.5;}
.tela-redes-sociais :deep(.admin-msg){font-family:'IBM Plex Sans',sans-serif;font-size:11px;margin-top:8px;padding:7px 12px;border-radius:3px;display:none;}
.tela-redes-sociais :deep(.admin-msg.ok){background:rgba(26,110,69,.07);color:var(--green);}
.tela-redes-sociais :deep(.admin-msg.err){background:rgba(176,30,58,.06);color:var(--red);}
.tela-redes-sociais :deep(.user-list){display:flex;flex-direction:column;gap:8px;}
.tela-redes-sociais :deep(.user-row){display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--surface2);border-radius:3px;border:1px solid var(--border);}
.tela-redes-sociais :deep(.user-info){display:flex;flex-direction:column;gap:2px;}
.tela-redes-sociais :deep(.user-email){font-family:'IBM Plex Sans',sans-serif;font-size:12px;font-weight:600;color:var(--text);}
.tela-redes-sociais :deep(.user-name){font-family:'IBM Plex Sans',sans-serif;font-size:11px;font-weight:400;color:var(--muted);}
.tela-redes-sociais :deep(.user-role-select){font-family:'IBM Plex Sans',sans-serif;font-size:11px;padding:4px 8px;background:var(--surface);border:1px solid var(--border);border-radius:3px;color:var(--text);cursor:pointer;outline:none;}

/* ── RESPONSIVE ── */

/* MOBILE (≤ 480px) */
@media(max-width:480px){
  .tela-redes-sociais :deep(.wrapper){padding:0 0 24px;}
  .tela-redes-sociais :deep(.topbar){flex-wrap:wrap;gap:0;padding:0;margin-bottom:0;border-bottom:1px solid var(--border);}
  .tela-redes-sociais :deep(.topbar-left){flex:1;min-width:0;gap:8px;padding:9px 12px;order:1;}
  .tela-redes-sociais :deep(.topbar-right){gap:6px;padding:9px 12px;order:2;}
  .tela-redes-sociais :deep(.topbar-center){order:3;width:100%;padding:6px 12px 8px;border-top:1px solid var(--border);overflow-x:auto;-webkit-overflow-scrolling:touch;gap:6px;flex-wrap:nowrap;box-sizing:border-box;}
  .tela-redes-sociais :deep(.topbar) .rbv-logo{display:none!important;}
  .tela-redes-sociais :deep(.gv-perf-tag){font-size:9px!important;letter-spacing:2px!important;}
  .tela-redes-sociais :deep(.gv-brand-tag){display:none!important;}
  .tela-redes-sociais :deep(.period-tabs){gap:3px;flex-shrink:0;}
  .tela-redes-sociais :deep(.ptab){padding:5px 10px;font-size:10px;letter-spacing:.5px;}
  .tela-redes-sociais :deep(#dash-clock){font-size:11px;}
  .tela-redes-sociais :deep(.live-dot){font-size:8px;letter-spacing:1px;}
  .tela-redes-sociais :deep(.ac-toggle-lbl){display:none;}
  .tela-redes-sociais :deep(.ac-toggle){flex-shrink:0;}
  .tela-redes-sociais :deep(.gv-back){font-size:11px;padding:5px 10px;}
  .tela-redes-sociais :deep(header){padding:8px 12px;margin-bottom:0;gap:8px;flex-wrap:nowrap;overflow:hidden;border-bottom:1px solid var(--border);}
  .tela-redes-sociais :deep(#header-collapsible){flex:1;min-width:0;overflow-x:auto;-webkit-overflow-scrolling:touch;}
  .tela-redes-sociais :deep(.profile-select){flex-wrap:nowrap;gap:5px;}
  .tela-redes-sociais :deep(.profile-btn){padding:5px 8px;font-size:10px;white-space:nowrap;flex-shrink:0;}
  .tela-redes-sociais :deep(.profile-btn .av){width:18px;height:18px;font-size:8px;}
  .tela-redes-sociais :deep(#header-toggle){flex-shrink:0;align-self:center;}
  .tela-redes-sociais :deep(#active-profile-bar){padding:8px 12px;margin-bottom:0;gap:7px;border-bottom:1px solid var(--border);}
  .tela-redes-sociais :deep(#apb-name){font-size:15px;letter-spacing:1.5px;}
  .tela-redes-sociais :deep(#apb-ring-wrap){display:flex;}
  .tela-redes-sociais :deep(#apb-img){width:28px;height:28px;}
  .tela-redes-sociais :deep(#apb-dot){width:6px;height:6px;}
  .tela-redes-sociais :deep(.sec-header){margin:14px 12px 8px;padding-bottom:0;}
  .tela-redes-sociais :deep(.section-label){font-size:8px;letter-spacing:2px;}
  .tela-redes-sociais :deep(.sec-chip){font-size:8px;padding:2px 6px;}
  .tela-redes-sociais :deep(.camp-filter-bar){padding:6px 12px;font-size:10px;gap:5px;}
  .tela-redes-sociais :deep(.camp-filter-lbl){display:none;}
  .tela-redes-sociais :deep(.btn-campaign-filter){font-size:9px;padding:4px 8px;}
  .tela-redes-sociais :deep(.sec1-grid),.tela-redes-sociais :deep(.sec2-grid),.tela-redes-sociais :deep(.sec3-grid),.tela-redes-sociais :deep(.sec4-grid){grid-template-columns:1fr;gap:8px;padding:0 12px;margin-left:0;margin-right:0;}
  .tela-redes-sociais :deep(.mb40){margin-bottom:16px;}
  .tela-redes-sociais :deep(.card){padding:13px 14px;border-radius:3px;}
  .tela-redes-sociais :deep(.mc-val){font-size:32px;margin-bottom:5px;}
  .tela-redes-sociais :deep(#total-followers){font-size:38px!important;}
  .tela-redes-sociais :deep(.mc-lbl){font-size:8px;letter-spacing:1.5px;}
  .tela-redes-sociais :deep(.mc-compare-prev),.tela-redes-sociais :deep(.mc-compare-delta){font-size:11px;}
  .tela-redes-sociais :deep(.mc-pct){font-size:13px;}
  .tela-redes-sociais :deep(.mc-diff){font-size:11px;}
  .tela-redes-sociais :deep(.mc-icon){font-size:16px;}
  .tela-redes-sociais :deep(.calc-badge){font-size:8px;padding:4px 8px;margin-top:8px;}
  .tela-redes-sociais :deep(#followers-hero){padding:14px 14px 12px;}
  .tela-redes-sociais :deep(#followers-hero) .mc-lbl{font-size:7px;margin-bottom:6px;}
  .tela-redes-sociais :deep(.chart-legend){flex-wrap:wrap;gap:4px;}
  .tela-redes-sociais :deep(.x-labels){font-size:8px;}
}

/* TABLET (481px – 1024px) */
@media(min-width:481px) and (max-width:1024px){
  .tela-redes-sociais :deep(.wrapper){padding:14px 20px;}
  .tela-redes-sociais :deep(.sec1-grid){grid-template-columns:1fr;}
  .tela-redes-sociais :deep(.sec3-grid){grid-template-columns:repeat(2,1fr);}
  .tela-redes-sociais :deep(.mc-val){font-size:38px;}
  .tela-redes-sociais :deep(#total-followers){font-size:48px!important;}
  .tela-redes-sociais :deep(#apb-name){font-size:18px;}
}

/* TV / WIDESCREEN (≥ 1600px) */
@media(min-width:1600px){
  .tela-redes-sociais :deep(.wrapper){max-width:none;padding:24px 5vw;}
  .tela-redes-sociais :deep(header){margin-bottom:18px;padding-bottom:14px;}
  .tela-redes-sociais :deep(#apb-name){font-size:30px;}
  .tela-redes-sociais :deep(#apb-dot){width:11px;height:11px;}
  .tela-redes-sociais :deep(.section-label){font-size:13px;}
  .tela-redes-sociais :deep(.mc-lbl){font-size:13px;}
  .tela-redes-sociais :deep(.mc-val){font-size:58px;}
  .tela-redes-sociais :deep(#total-followers){font-size:72px!important;}
  .tela-redes-sociais :deep(.card){padding:28px 32px;}
  .tela-redes-sociais :deep(.mb40){margin-bottom:30px;}
  .tela-redes-sociais :deep(.sec-header){margin-bottom:12px;}
  .tela-redes-sociais :deep(.sec3-grid){grid-template-columns:repeat(3,1fr);gap:20px;}
  .tela-redes-sociais :deep(.sec4-grid){grid-template-columns:repeat(3,1fr);gap:20px;}
  .tela-redes-sociais :deep(.sec1-grid){grid-template-columns:340px 1fr;gap:20px;}
  .tela-redes-sociais :deep(.ptab){padding:6px 20px;font-size:13px;}
  .tela-redes-sociais :deep(.profile-btn){padding:9px 18px;font-size:13px;}
  .tela-redes-sociais :deep(.profile-btn .av){width:26px;height:26px;font-size:11px;}
  .tela-redes-sociais :deep(.mc-compare-prev),.tela-redes-sociais :deep(.mc-compare-delta){font-size:14px;}
  .tela-redes-sociais :deep(.mc-pct){font-size:18px;}
  .tela-redes-sociais :deep(.mc-diff){font-size:12px;}
  .tela-redes-sociais :deep(.sec-chip){font-size:12px;padding:4px 10px;}
  .tela-redes-sociais :deep(#autocycle-badge){font-size:13px;padding:9px 18px;}
}

/* FULLHD+ (≥ 1920px) */
@media(min-width:1920px){
  .tela-redes-sociais :deep(.mc-val){font-size:68px;}
  .tela-redes-sociais :deep(#total-followers){font-size:84px!important;}
  .tela-redes-sociais :deep(#apb-name){font-size:36px;}
  .tela-redes-sociais :deep(.card){padding:32px 36px;}
}

/* TV MODE (body.dev-tv — somente ≥ 1920px via JS de detecção de dispositivo) */
body.dev-tv .tela-redes-sociais :deep(.wrapper){max-width:none;padding:24px 40px;}
body.dev-tv .tela-redes-sociais :deep(#apb-name){font-size:52px;}
body.dev-tv .tela-redes-sociais :deep(.section-label){font-size:18px;letter-spacing:3px;}
body.dev-tv .tela-redes-sociais :deep(.mc-lbl){font-size:16px;letter-spacing:2px;}
body.dev-tv .tela-redes-sociais :deep(.mc-val){font-size:100px;}
body.dev-tv .tela-redes-sociais :deep(#total-followers){font-size:96px!important;}
body.dev-tv .tela-redes-sociais :deep(.mc-compare-label){font-size:14px;}
body.dev-tv .tela-redes-sociais :deep(.mc-compare-prev){font-size:20px;}
body.dev-tv .tela-redes-sociais :deep(.mc-compare-delta){font-size:20px;}
body.dev-tv .tela-redes-sociais :deep(.mc-pct){font-size:26px;}
body.dev-tv .tela-redes-sociais :deep(.mc-diff){font-size:16px;}
body.dev-tv .tela-redes-sociais :deep(.sec-chip){font-size:14px;padding:5px 12px;}
body.dev-tv .tela-redes-sociais :deep(.profile-btn){font-size:16px;padding:10px 22px;}
body.dev-tv .tela-redes-sociais :deep(.profile-btn .av){width:30px;height:30px;font-size:13px;}
body.dev-tv .tela-redes-sociais :deep(#apb-img){width:64px;height:64px;}
body.dev-tv .tela-redes-sociais :deep(.ptab){font-size:16px;padding:8px 24px;}
body.dev-tv .tela-redes-sociais :deep(.live-dot){font-size:13px;}
body.dev-tv .tela-redes-sociais :deep(.ac-toggle-lbl){font-size:14px;}
body.dev-tv .tela-redes-sociais :deep(#dash-clock){font-size:23px;}
body.dev-tv .tela-redes-sociais :deep(.insight-icon){font-size:17px;}
body.dev-tv .tela-redes-sociais :deep(.insight-title){font-size:14px;}
body.dev-tv .tela-redes-sociais :deep(.insight-period){font-size:14px;padding:3px 10px;}
body.dev-tv .tela-redes-sociais :deep(.insight-item){font-size:17px;padding:5px 15px;}
body.dev-tv .tela-redes-sociais :deep(.overall-bar-lbl){font-size:14px;}
body.dev-tv .tela-redes-sociais :deep(.overall-bar-pct){font-size:20px;}
body.dev-tv .tela-redes-sociais :deep(.legend-item){font-size:13px;}
body.dev-tv .tela-redes-sociais :deep(.mc-goal-lbl){font-size:13px;}
body.dev-tv .tela-redes-sociais :deep(.mc-goal-val){font-size:16px;}
body.dev-tv .tela-redes-sociais :deep(.calc-badge){font-size:13px;padding:4px 12px;}
body.dev-tv .tela-redes-sociais :deep(.camp-filter-lbl){font-size:13px;}
body.dev-tv .tela-redes-sociais :deep(.camp-filter-info){font-size:16px;}
body.dev-tv .tela-redes-sociais :deep(.btn-campaign-filter){font-size:13px;}
body.dev-tv .tela-redes-sociais :deep(.rbv-logo){height:72px;}
</style>
