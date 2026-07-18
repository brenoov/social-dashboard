<template>
  <!-- Porte fiel de #gestao-trafego-screen (legacy/index.html L12078-12128) +
       os dois modais que pertencem a esta tela (editor de métricas por
       objetivo, L12131-12143, e "ver criativo", L12145-12149), VERBATIM.
       Mesmo padrão da Gestão à Vista / Análise de Campanhas: root vira
       .tela-gestao-trafego (sem display:none — quem controla a visibilidade
       agora é o vue-router), IDs mantidos (usados por getElementById no JS
       imperativo abaixo). Único onclick trocado por binding Vue: o botão
       "Meta Ads" (Voltar) — closeGestaoTrafego vira @click, e a função por
       trás dele agora também limpa os timers e navega pelo router. Os demais
       onclick="setGtPeriod(this)"/"loadGtData()"/"_gtOpenEditor()"/
       "toggleGtAccPicker()"/"event.stopPropagation()"/"_gtCloseEditor()"/
       "_gtSaveEditor()"/"_gtCloseCriativo()" ficam como STRING literal (igual
       ao legado) — são atributos HTML nativos, avaliados no escopo global;
       por isso o cluster de funções que eles chamam é exposto em window mais
       abaixo. Os dois modais (que no legado são <div> irmãos soltos no body,
       fora de #gestao-trafego-screen) foram colocados DENTRO da raiz deste
       componente — são posicionados via position:fixed, então o lugar deles
       na árvore do DOM não muda o layout visual, e ficar dentro da árvore do
       componente é o que permite ao CSS :deep() (scoped) alcançá-los. -->
  <div class="tela-gestao-trafego">
    <div class="gv-topbar">
      <div class="gv-topbar-brand" style="display:flex;align-items:center;gap:14px">
        <button class="gv-back" @click="closeGestaoTrafego">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Meta Ads
        </button>
        <img class="rbv-logo rbv-logo-light" :src="logoClaroUrl" alt="RBV">
        <img class="rbv-logo rbv-logo-dark" :src="logoEscuroUrl" alt="RBV">
        <div style="display:flex;flex-direction:column;gap:2px">
          <span class="gv-perf-tag" style="font-size:calc(11px*var(--gt-fs,1.3));letter-spacing:4px;">Gestão de Tráfego</span>
          <span class="gv-brand-tag" style="font-size:calc(9px*var(--gt-fs,1.3));letter-spacing:2px;opacity:.5;">Agente IA · Meta Ads</span>
        </div>
      </div>
      <div class="gv-period-btns" id="gt-period-btns">
        <button class="gv-pbtn" data-preset="today" onclick="setGtPeriod(this)"><span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--green);margin-right:5px;animation:pulse 2s infinite;vertical-align:middle;flex-shrink:0;"></span>HOJE</button>
        <button class="gv-pbtn" data-preset="1d" onclick="setGtPeriod(this)">1D</button>
        <button class="gv-pbtn" data-preset="7d" onclick="setGtPeriod(this)">7D</button>
        <button class="gv-pbtn" data-preset="14d" onclick="setGtPeriod(this)">14D</button>
        <button class="gv-pbtn" data-preset="30d" onclick="setGtPeriod(this)">30D</button>
        <button class="gv-pbtn" data-preset="monthfull" onclick="setGtPeriod(this)">MÊS</button>
        <button class="gv-pbtn" data-preset="lastmonth" onclick="setGtPeriod(this)">MÊS PASS.</button>
        <button class="gv-pbtn active" data-preset="sofar" onclick="setGtPeriod(this)">ATÉ AGORA</button>
        <button class="gv-pbtn" onclick="loadGtData()" style="border-color:var(--accent);color:var(--accent)">↻</button>
      </div>
      <button class="gt-auto-btn" id="gt-cfg-btn" style="display:none" onclick="_gtOpenEditor()" title="Configurar métricas por objetivo">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        <span>KPIs</span>
      </button>
      <div id="gt-account-picker" onclick="event.stopPropagation()" style="position:relative;display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0;">
        <button id="gt-acc-trigger" style="display:flex;align-items:center;gap:8px;border:1px solid var(--border);border-radius:7px;padding:5px 12px;background:var(--surface2);cursor:pointer;font-family:var(--fonte-principal);font-size:calc(12px*var(--gt-fs,1.3));color:var(--text);white-space:nowrap;" onclick="event.stopPropagation();toggleGtAccPicker()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:.6"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          <span id="gt-acc-name" style="font-weight:500;max-width:140px;overflow:hidden;text-overflow:ellipsis;">—</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div id="gt-acc-dropdown" style="display:none;position:absolute;top:calc(100% + 6px);right:0;min-width:270px;background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:0 8px 28px rgba(0,0,0,.18);z-index:999;overflow:hidden;max-height:340px;overflow-y:auto;" onclick="event.stopPropagation()"></div>
      </div>
      <div class="gv-clock-wrap" onclick="event.stopPropagation()">
        <span class="live-dot" style="margin-bottom:4px">Tempo Real</span>
        <div class="gv-clock-time" id="gt-clock">--:--:--</div>
        <div class="gv-clock-date" id="gt-date"></div>
        <div class="gv-update-status" id="gt-update-status">—</div>
      </div>
    </div>
    <div class="gt-body">
      <div id="gt-camp-col">
        <div class="gt-camp-card"><div class="gt-empty">Carregando…</div></div>
      </div>
    </div>

    <!-- ── EDITOR DE MÉTRICAS POR OBJETIVO (ADMIN) ── -->
    <div id="gt-cfg-overlay" onclick="_gtCloseEditor()"></div>
    <div id="gt-cfg-modal">
      <div class="gt-cfg-head">
        <span class="gt-cfg-title">⚙️ Métricas por Objetivo</span>
        <button class="gt-cfg-close" onclick="_gtCloseEditor()">✕</button>
      </div>
      <div class="gt-cfg-body" id="gt-cfg-body"></div>
      <div class="gt-cfg-footer">
        <button style="padding:7px 16px;border-radius:7px;font-family:var(--fonte-principal);font-size:calc(11px*var(--gt-fs,1.3));font-weight:600;cursor:pointer;border:1px solid var(--border);background:none;color:var(--muted);" onclick="_gtCloseEditor()">Cancelar</button>
        <button id="gt-cfg-save-btn" style="padding:7px 18px;border-radius:7px;font-family:var(--fonte-principal);font-size:calc(11px*var(--gt-fs,1.3));font-weight:700;cursor:pointer;border:none;background:var(--accent);color:#fff;" onclick="_gtSaveEditor()">Salvar</button>
      </div>
    </div>

    <div id="gt-cr-overlay" onclick="_gtCloseCriativo()"></div>
    <div id="gt-cr-modal">
      <div class="gt-cfg-head"><span class="gt-cfg-title" id="gt-cr-title">Criativo do anúncio</span><button class="gt-cfg-close" onclick="_gtCloseCriativo()">✕</button></div>
      <div class="gt-cr-body" id="gt-cr-body"></div>
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
import { hojeLocal, diasAtras, primeiroDiaDoMes, ultimoDiaDoMes } from '../../compartilhado/datas.js'
// Decisão "o orçamento é da campanha (CBO) ou dos conjuntos (ABO)?" e o
// agrupamento campanha → conjuntos → anúncios moram num módulo puro, testado
// em orcamento-hierarquia.test.mjs. Aqui só se desenha o resultado.
import { orcamentoDe, detectarNivelOrcamento, podeEditarOrcamentoDaCampanha, podeEditarOrcamentoDoConjunto, montarHierarquia } from './orcamento-hierarquia.js'

const router = useRouter()

const logoClaroUrl = '/midia/LOGOTIPOBRENOPRETO.png'
const logoEscuroUrl = '/midia/LOGOTIPOBRENOBRANCO.png'

// ==========================================================================
// PORTE VERBATIM da Gestão de Tráfego (legacy/index.html — funções e estado
// espalhados entre L7768-8594), menos openGestaoTrafego/closeGestaoTrafego,
// que viraram onMounted/closeGestaoTrafego(cleanup+router) abaixo, e o
// listener de fechar o dropdown de contas (documento inteiro), que virou
// addEventListener/removeEventListener em onMounted/onUnmounted em vez de
// rodar sempre solto no escopo global do monólito.
//
// ATENÇÃO — esta tela EXECUTA AÇÕES REAIS em campanhas/anúncios ao vivo na
// Meta (pausar, reativar, mudar orçamento) através de _gtApplyAction/metaPost.
// Toda ação passa por _gtConfirm(...) antes de chamar metaPost — esse gate
// foi preservado intacto, idêntico ao legado (ver auditoria no fim deste
// bloco de comentário, e o relatório em .superpowers/sdd/gt-port-report.md).
//
// Dependências externas resolvidas:
//   - sbClient, SUPABASE_URL, SUPABASE_ANON_KEY → import (conectar-no-banco-de-dados.js)
//   - hasPermission                              → import (controle-de-login-e-usuario.js)
//   - adminToast                                 → import (avisos.js)
//   - sb                                         → import (buscar-e-salvar-dados.js) — helper
//     de leitura REST já extraído para o miolo compartilhado (idêntico ao sb()
//     do legado, legacy L3356, só troca currentSession por estado.currentSession);
//     reaproveitado aqui em vez de copiado de novo (usado por
//     _gtLoadConfig/_gtLoadBudgetIA/_gtLoadAdIA).
//   - estado.currentSession                      → substitui a global solta `currentSession`
//     do legado, usada dentro de adTok()/metaFetch()/metaPost() (legacy L3358/8508/8570).
//   - metaFetch, metaFetchAll, metaPost, adFetch, adTok, _maCleanAccId, _getActions,
//     _maFmtR, _maFmt, _maFmtPct, _maObjLabel → COPIADOS abaixo (helpers do
//     legado que este módulo usa e que ainda não têm um lugar compartilhado no
//     Vue; ver legacy L8569, L8584, L8507, L4376, L8920, L8943, L8953-8955,
//     L507-510 do porte de Análise de Campanhas). escHtml e fmtR (legacy
//     L4851/L3394) foram conferidos por grep no bloco inteiro (L7768-8594) e
//     NÃO são usados pela Gestão de Tráfego (ela usa só _gtEsc/_maFmtR) —
//     por isso não foram copiados (evitar código morto).
//   - _maAccounts/_maCurAcc (globais da Análise de Campanhas, outro módulo,
//     inexistentes aqui) → SUBSTITUÍDOS por uma lista própria da Gestão de
//     Tráfego, _gtAccounts (_gtCurAcc já existia no legado). _buildGtDropdown
//     e _initGestaoTrafego foram ajustados para usar _gtAccounts em vez de
//     _maAccounts — a linha `_maCurAcc=_maCurAcc||_gtCurAcc` (sincronismo
//     entre os dois módulos dentro do monólito) foi removida: não existe mais
//     "o outro módulo" para sincronizar, cada tela Vue é independente.
//
// Nada foi reescrito para template reativo — o board de campanhas (#gt-camp-col)
// e os dois modais seguem montados via getElementById/createElement/innerHTML,
// exatamente como a produção atual. Por isso todo o cluster de funções GT
// usadas em onclick="..." (no <template> acima) é exposto em window no fim
// deste bloco. Conferido por grep: dentro do HTML gerado em runtime
// (_renderGtCampaigns/_renderGtAds/_gtRecBanner/_buildGtDropdown/_gtConfirm)
// NENHUMA função é chamada por onclick="..." literal — todas usam
// addEventListener ou atribuição direta a .onclick (closures em escopo de
// módulo), então não precisam ser expostas em window.
// ==========================================================================

/* ── Helpers copiados do legado (self-contidos) ── */
function adTok(){return estado.currentSession?.access_token||SUPABASE_ANON_KEY;}
function adFetch(path,opts={}){return fetch(`${SUPABASE_URL}/rest/v1/${path}`,{...opts,headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${adTok()}`,'Content-Type':'application/json',...(opts.headers||{})}});}
async function metaFetch(path,params,accountId){
  const{data:{session}}=await sbClient.auth.getSession();
  if(!session)throw new Error('Não autenticado');
  const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),15000);
  try{
    const r=await fetch(SUPABASE_URL+'/functions/v1/meta-proxy',{
      method:'POST',signal:ctrl.signal,
      headers:{'Authorization':'Bearer '+session.access_token,'apikey':SUPABASE_ANON_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({accountId,path,params})
    });
    const d=await r.json();
    if(d&&d.error)throw new Error((d.error&&d.error.message)||d.error||'Meta API error');
    return d;
  }finally{clearTimeout(timer);}
}
async function metaFetchAll(path,params,accountId){
  let results=[];const p={...params,limit:500};
  let data=await metaFetch(path,p,accountId);
  results=results.concat(data.data||[]);
  while(data.paging?.cursors?.after&&results.length<2000){
    const np={...p,after:data.paging.cursors.after};
    data=await metaFetch(path,np,accountId);
    results=results.concat(data.data||[]);
  }
  return results;
}
async function metaPost(path,params,accountId){
  const{data:{session}}=await sbClient.auth.getSession();
  if(!session)throw new Error('Não autenticado');
  const r=await fetch(SUPABASE_URL+'/functions/v1/meta-proxy',{
    method:'POST',
    headers:{'Authorization':'Bearer '+session.access_token,'apikey':SUPABASE_ANON_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({accountId,path,params,method:'POST'})
  });
  const d=await r.json();
  if(d&&d.error)throw new Error((d.error&&d.error.message)||d.error||'Meta API error');
  return d;
}
function _maCleanAccId(id){return String(id||'').replace(/^act_/,'');}
function _getActions(ins,type){
  const a=(ins.actions||[]).find(x=>x.action_type===type);
  return a?parseFloat(a.value||0):0;
}
function _maFmtR(v){if(!v&&v!==0)return'—';const n=parseFloat(v);if(n>=1000)return'R$'+n.toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0});return'R$'+n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});}
function _maFmt(v,dec=0){if(!v&&v!==0)return'—';return parseFloat(v).toLocaleString('pt-BR',{minimumFractionDigits:dec,maximumFractionDigits:dec});}
function _maFmtPct(v){return parseFloat(v||0).toFixed(2)+'%';}
function _maObjLabel(obj){
  const m={OUTCOME_TRAFFIC:'Tráfego',OUTCOME_ENGAGEMENT:'Engajamento',OUTCOME_LEADS:'Leads',OUTCOME_SALES:'Vendas',OUTCOME_AWARENESS:'Reconhecimento',LINK_CLICKS:'Cliques',PAGE_LIKES:'Curtidas',VIDEO_VIEWS:'Vídeo'};
  return m[obj]||(obj||'—');
}

/* ── GESTÃO DE TRÁFEGO — estado do módulo (legacy L7768-7776, verbatim,
   exceto _gtAccounts, que substitui a global _maAccounts do legado — ver
   nota de dependências acima) ── */
let _gtPreset='sofar';
let _gtCurAcc=null;
let _gtAccounts=[];
let _gtLastLoadTime=null;
let _gtStatusTimer=null;
let _gtClockTimer=null;
let _gtPickerOpen=false;
let _gtCampaigns=[];
let _gtInsights=[];
let _gtAdInsights=[];
let _gtAdsets=[];        // conjuntos de anúncios da conta (Graph /adsets), com o orçamento de cada um
let _gtRecolhido=false;  // botão "recolher/expandir tudo": estado padrão dos painéis ao (re)desenhar
let _gtStatusFilter='all';

/* ── Zoom de fonte (legacy L7789-7805, verbatim) ── */
function _gtFontScale(){
  const screen=document.querySelector('.tela-gestao-trafego');if(!screen)return;
  const K='rbv-gtfs';
  let z=parseFloat(localStorage.getItem(K));if(!(z>=0.9&&z<=2.5))z=1.3;
  let ctl=screen.querySelector(':scope > .zoomctl');
  const apply=()=>{screen.style.setProperty('--gt-fs',String(z));document.documentElement.style.setProperty('--gt-fs',String(z));try{localStorage.setItem(K,String(z));}catch(e){}const v=ctl&&ctl.querySelector('.zoomctl-val');if(v)v.textContent=Math.round(z*100)+'%';};
  if(!ctl){
    ctl=document.createElement('div');ctl.className='zoomctl';
    const mk=(t,title,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=t;b.title=title;b.onclick=fn;return b;};
    ctl.appendChild(mk('A−','Diminuir fonte',()=>{z=Math.max(0.9,Math.round((z-0.1)*10)/10);apply();}));
    const val=document.createElement('span');val.className='zoomctl-val';val.title='Restaurar padrão (130%)';val.onclick=()=>{z=1.3;apply();};
    ctl.appendChild(val);
    ctl.appendChild(mk('A+','Aumentar fonte',()=>{z=Math.min(2.5,Math.round((z+0.1)*10)/10);apply();}));
    screen.appendChild(ctl);
  }
  apply();
}

/* ── Relógio / status de atualização (legacy L7814-7832, verbatim) ── */
function startGtClock(){
  const tEl=document.getElementById('gt-clock'),dEl=document.getElementById('gt-date');
  if(!tEl)return;
  const tick=()=>{
    const now=new Date();
    tEl.textContent=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0')+':'+String(now.getSeconds()).padStart(2,'0');
    if(dEl){const ds=now.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'});dEl.textContent=ds.toUpperCase();}
  };
  tick();if(_gtClockTimer)clearInterval(_gtClockTimer);
  _gtClockTimer=setInterval(tick,1000);
}
function updateGtUpdateStatus(){
  const el=document.getElementById('gt-update-status');if(!el)return;
  if(!_gtLastLoadTime){el.textContent='—';return;}
  const pad=n=>String(n).padStart(2,'0');
  const fmt=d=>`${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const next=new Date(_gtLastLoadTime.getTime()+5*60*1000);
  el.textContent=`ULT. ${fmt(_gtLastLoadTime)} · PRÓX. ${fmt(next)}`;
}

/* ── Período / seletor de conta (legacy L7833-7858, verbatim, exceto
   _buildGtDropdown, que usa _gtAccounts em vez de _maAccounts) ── */
function setGtPeriod(btn){
  document.querySelectorAll('#gt-period-btns .gv-pbtn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  _gtPreset=btn.dataset.preset;
  loadGtData();
}
function toggleGtAccPicker(){
  _gtPickerOpen=!_gtPickerOpen;
  const d=document.getElementById('gt-acc-dropdown');if(d)d.style.display=_gtPickerOpen?'block':'none';
}
// No legado este listener era registrado uma vez, solto, no carregamento do
// script inteiro (document.addEventListener('click',()=>{...}), legacy L7843).
// Aqui vira uma função nomeada, amarrada ao ciclo de vida do componente
// (addEventListener/removeEventListener em onMounted/onUnmounted mais abaixo)
// — mesmo padrão já usado no porte da Análise de Campanhas (_maDocClick).
function _gtDocClick(){
  _gtPickerOpen=false;
  const d=document.getElementById('gt-acc-dropdown');if(d)d.style.display='none';
}
function _buildGtDropdown(){
  const drop=document.getElementById('gt-acc-dropdown');if(!drop)return;
  drop.innerHTML='';
  _gtAccounts.forEach((a,idx)=>{
    const bal=a.balance;
    // "sem limite" (spend_cap=0) mostra texto neutro, não número. Com limite: verde=folgado,
    // âmbar=apertando, vermelho=quase no teto.
    const balTxt=a.semLimite?'sem limite':(bal!=null?_maFmtR(bal):'—');
    const balColor=a.semLimite?'var(--muted)':bal==null?'var(--muted)':bal>=1000?'#16a34a':bal>=500?'#f59e0b':'#dc2626';
    const item=document.createElement('div');
    item.style.cssText='padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;transition:background .12s;';
    item.addEventListener('mouseenter',()=>item.style.background='var(--surface2)');
    item.addEventListener('mouseleave',()=>item.style.background='');
    item.innerHTML=`<span style="font-family:var(--fonte-principal);font-size:calc(11px*var(--gt-fs,1.3));color:var(--muted);min-width:18px;">${idx+1}</span><div style="flex:1;min-width:0;"><div style="font-family:var(--fonte-principal);font-size:calc(12px*var(--gt-fs,1.3));font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${a.display_name||a.name||'Conta '+idx}</div><div style="font-family:var(--fonte-principal);font-size:calc(10px*var(--gt-fs,1.3));color:var(--muted);">${_maFmt(a.monthSpend||0,0)} gastos / mês</div></div><div style="font-family:var(--fonte-principal);font-size:calc(13px*var(--gt-fs,1.3));font-weight:700;color:${balColor};flex-shrink:0;">${balTxt}</div>`;
    item.addEventListener('click',e=>{e.stopPropagation();_gtCurAcc=a;const nm=document.getElementById('gt-acc-name');if(nm)nm.textContent=a.display_name||a.name||'—';_gtPickerOpen=false;const d=document.getElementById('gt-acc-dropdown');if(d)d.style.display='none';loadGtData();});
    drop.appendChild(item);
  });
}
async function _initGestaoTrafego(){
  const col=document.getElementById('gt-camp-col');
  const setLbl=t=>{if(col)col.innerHTML=`<div class="gv-loading-screen"><div class="gv-spinner"></div><span class="gv-loading-lbl">${t}</span></div>`;};
  setLbl('Carregando contas…');
  try{
    const res=await adFetch('accounts?select=id,name,ad_account_id,profile_picture_url,picture_url&order=name.asc');
    const socialAccs=await res.json();
    const seen=new Set();
    const accs=[];
    // Step 1 — accounts with ad_account_id explicitly in Supabase
    for(const acc of socialAccs){
      if(!acc.ad_account_id)continue;
      const cid=_maCleanAccId(acc.ad_account_id);
      if(seen.has(cid))continue;seen.add(cid);
      accs.push({...acc,ad_account_id:cid,display_name:acc.name,monthSpend:0,balance:null});
    }
    // Step 2 — discover remaining ad accounts via /me/adaccounts (token lives in meta-proxy).
    // Any account row works as proxy carrier: meta-proxy resolves the shared token from accounts.id.
    const carrierId=socialAccs.find(a=>a.id)?.id||null;
    if(carrierId){
      const adAccPhotoMap={};
      socialAccs.forEach(a=>{if(a.ad_account_id&&(a.profile_picture_url||a.picture_url))adAccPhotoMap[_maCleanAccId(a.ad_account_id)]=a.profile_picture_url||a.picture_url;});
      try{
        const d=await metaFetch('/me/adaccounts',{fields:'id,name,account_status,currency'},carrierId);
        for(const adAcc of(d?.data||[])){
          const cid=_maCleanAccId(adAcc.id);
          if(seen.has(cid))continue;seen.add(cid);
          accs.push({id:carrierId,name:adAcc.name,ad_account_id:cid,display_name:adAcc.name,currency:adAcc.currency,account_status:adAcc.account_status,profile_picture_url:adAccPhotoMap[cid]||'',picture_url:'',monthSpend:0,balance:null});
        }
      }catch(e){console.warn('[GT] /me/adaccounts discovery failed:',e.message);}
    }
    if(!accs.length){
      if(col)col.innerHTML='<div class="gt-camp-card"><div class="gt-empty">Nenhuma conta de anúncios encontrada.</div></div>';
      return;
    }
    setLbl(`Calculando gastos de ${accs.length} conta${accs.length!==1?'s':''}…`);
    await Promise.all(accs.map(async a=>{
      try{
        const [d,sp]=await Promise.all([
          metaFetch(`/act_${a.ad_account_id}`,{fields:'name,balance,currency,spend_cap,amount_spent'},a.id),
          metaFetch(`/act_${a.ad_account_id}/insights`,{fields:'spend',date_preset:'this_month'},a.id).catch(()=>null),
        ]);
        if(d?.name)a.display_name=d.name;
        // SALDO = "quanto ainda posso gastar" = limite da conta (spend_cap) MENOS o gasto
        // (amount_spent). Antes o painel mostrava o campo `balance` do Meta, que NÃO é saldo
        // disponível — é o gasto ainda não faturado (um número pequeno e enganoso, ex.: R$550
        // na La Vessel I quando o saldo real é ~R$6 mil).
        // spend_cap = 0 no Meta significa "SEM limite de gastos". Nesses casos não existe
        // "quanto sobra" (é ilimitado), então marcamos semLimite e não mostramos número — antes
        // isso virava um negativo gigante (limite 0 − gasto = -251 mil na Raissa), puro lixo.
        const cap=parseFloat(d?.spend_cap||0), gastoTotal=parseFloat(d?.amount_spent||0);
        a.semLimite=!(cap>0);
        a.balance=cap>0?(cap-gastoTotal)/100:null;
        if(d?.currency)a.currency=d.currency;
        a.monthSpend=parseFloat(sp?.data?.[0]?.spend||0);
      }catch(e){a.monthSpend=0;}
    }));
    accs.sort((a,b)=>(b.monthSpend||0)-(a.monthSpend||0));
    _gtAccounts.length=0;
    _gtAccounts.push(...accs);
    _gtCurAcc=_gtAccounts[0];
    const nm=document.getElementById('gt-acc-name');
    if(nm)nm.textContent=_gtCurAcc?.display_name||_gtCurAcc?.name||'—';
    _buildGtDropdown();
    await loadGtData();
  }catch(e){
    if(col)col.innerHTML=`<div class="gt-camp-card"><div class="gt-empty">Erro ao carregar contas:<br>${e.message}</div></div>`;
  }
}

/* ── GT: CATÁLOGO DE MÉTRICAS POR OBJETIVO (legacy L7920-7966, verbatim) ── */
function _gtNum(x){ const n=Number(x); return isFinite(n)?n:null; }
function _gtActionVal(row, tipos){
  const arr=row&&row.actions; if(!Array.isArray(arr))return null;
  for(const t of tipos){ const a=arr.find(x=>x.action_type===t); if(a)return _gtNum(a.value); }
  return null;
}
function _gtActionValue(row, tipos){
  const arr=row&&row.action_values; if(!Array.isArray(arr))return null;
  for(const t of tipos){ const a=arr.find(x=>x.action_type===t); if(a)return _gtNum(a.value); }
  return null;
}
const _GT_PURCHASE=['purchase','omni_purchase','offsite_conversion.fb_pixel_purchase'];
const _GT_LEAD=['lead','onsite_conversion.lead_grouped','offsite_conversion.fb_pixel_lead'];
const _GT_VISIT=['landing_page_view','link_click'];
const GT_METRIC_CATALOG={
  alcance:{label:'Alcance',fmt:'int',compute:r=>_gtNum(r.reach)},
  impressoes:{label:'Impressões',fmt:'int',compute:r=>_gtNum(r.impressions)},
  frequencia:{label:'Frequência',fmt:'dec',compute:r=>_gtNum(r.frequency)},
  ctr:{label:'CTR',fmt:'pct',compute:r=>_gtNum(r.ctr)},
  cpc:{label:'CPC',fmt:'money',compute:r=>_gtNum(r.cpc)},
  cpm:{label:'CPM',fmt:'money',compute:r=>{const i=_gtNum(r.impressions),s=_gtNum(r.spend);return i?s/i*1000:null;}},
  cliques:{label:'Cliques',fmt:'int',compute:r=>_gtNum(r.clicks)},
  visitas:{label:'Visitas',fmt:'int',compute:r=>_gtActionVal(r,_GT_VISIT)},
  compras:{label:'Compras',fmt:'int',compute:r=>_gtActionVal(r,_GT_PURCHASE)},
  valor_conversao:{label:'Valor de conversão',fmt:'money',compute:r=>_gtActionValue(r,_GT_PURCHASE)},
  roas:{label:'ROAS',fmt:'x',compute:r=>{const pr=r.purchase_roas&&r.purchase_roas[0]&&_gtNum(r.purchase_roas[0].value);if(pr!=null)return pr;const v=_gtActionValue(r,_GT_PURCHASE),s=_gtNum(r.spend);return (v!=null&&s)?v/s:null;}},
  cac:{label:'CAC',fmt:'money',compute:r=>{const c=_gtActionVal(r,_GT_PURCHASE),s=_gtNum(r.spend);return c?s/c:null;}},
  gasto:{label:'Gasto',fmt:'money',compute:r=>_gtNum(r.spend)},
  leads:{label:'Leads',fmt:'int',compute:r=>_gtActionVal(r,_GT_LEAD)},
  custo_lead:{label:'Custo/Lead',fmt:'money',compute:r=>{const l=_gtActionVal(r,_GT_LEAD),s=_gtNum(r.spend);return l?s/l:null;}},
};
const GT_OBJETIVO_BALDE={
  OUTCOME_TRAFFIC:'trafego', LINK_CLICKS:'trafego',
  OUTCOME_SALES:'vendas', CONVERSIONS:'vendas', PRODUCT_CATALOG_SALES:'vendas',
  OUTCOME_AWARENESS:'reconhecimento', BRAND_AWARENESS:'reconhecimento', REACH:'reconhecimento', VIDEO_VIEWS:'reconhecimento',
  OUTCOME_ENGAGEMENT:'engajamento', POST_ENGAGEMENT:'engajamento', PAGE_LIKES:'engajamento', MESSAGES:'engajamento',
  OUTCOME_LEADS:'leads', LEAD_GENERATION:'leads',
};
const GT_BALDE_PADRAO={
  trafego:['ctr','cpc','visitas','cpm'],
  vendas:['roas','cac','valor_conversao','compras'],
  reconhecimento:['alcance','cpm','frequencia','impressoes'],
  engajamento:['ctr','cpc','cliques','gasto'],
  leads:['leads','custo_lead','ctr','gasto'],
  padrao:['ctr','cpc','gasto','alcance'],
};
function _gtBalde(objective){ return GT_OBJETIVO_BALDE[String(objective||'').toUpperCase()]||'padrao'; }
function _gtMetricValue(key,row){ const m=GT_METRIC_CATALOG[key]; return m?m.compute(row):null; }
let _gtConfig={};
let _gtConfigLoaded=false;
async function _gtLoadConfig(){
  try{
    const rows=await sb('gt_config_metricas?select=balde,metricas');
    _gtConfig={};
    (rows||[]).forEach(r=>{ if(Array.isArray(r.metricas)) _gtConfig[r.balde]=r.metricas; });
  }catch(e){ _gtConfig={}; }
}
let _gtBudgetIA={};
async function _gtLoadBudgetIA(){
  try{
    const rows=await sb('gt_budget_analises?select=campaign_id,budget_sugerido_centavos,veredito,justificativa,impacto_estimado,gerado_em,budget_atual_centavos');
    _gtBudgetIA={};
    (rows||[]).forEach(r=>{ if(r&&r.campaign_id) _gtBudgetIA[r.campaign_id]=r; });
  }catch(e){ _gtBudgetIA={}; }
}
let _gtAdIA={};
async function _gtLoadAdIA(){
  try{
    const rows=await sb('gt_ad_analises?select=ad_id,veredito,justificativa,gerado_em');
    _gtAdIA={};
    (rows||[]).forEach(r=>{ if(r&&r.ad_id) _gtAdIA[r.ad_id]=r; });
  }catch(e){ _gtAdIA={}; }
}
function _gtMetricasDoBalde(balde){
  const c=_gtConfig[balde];
  return (Array.isArray(c)&&c.length) ? c : (GT_BALDE_PADRAO[balde]||GT_BALDE_PADRAO.padrao);
}
function _gtFmt(v, fmt){
  if(v==null||!isFinite(v))return '—';
  if(fmt==='money')return 'R$ '+v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  if(fmt==='pct')return v.toLocaleString('pt-BR',{maximumFractionDigits:2})+'%';
  if(fmt==='x')return v.toLocaleString('pt-BR',{maximumFractionDigits:2})+'×';
  if(fmt==='dec')return v.toLocaleString('pt-BR',{maximumFractionDigits:2});
  return Math.round(v).toLocaleString('pt-BR'); // int
}
function _gtKpisHtml(row){
  const balde=_gtBalde(row.objective);
  const keys=_gtMetricasDoBalde(balde);
  return keys.map(k=>{ const m=GT_METRIC_CATALOG[k]; if(!m)return ''; const val=_gtFmt(m.compute(row), m.fmt);
    return `<div class="gt-kpi"><span class="gt-kpi-lbl">${m.label}</span><span class="gt-kpi-val">${val}</span></div>`;
  }).join('');
}
async function _gtSaveConfig(balde,metricas){
  // escrita autenticada via sbClient (JWT do usuário) — gated no banco por RLS
  // (profiles.role='admin'), mesmo padrão de adminSaveSetting()/platform_settings
  // e sr-btn de accounts.accent_color (ver db/migrations/006_accounts_update_policy.sql).
  const{error}=await sbClient.from('gt_config_metricas').upsert({balde,metricas,updated_at:new Date().toISOString()},{onConflict:'balde'});
  if(error) throw error;
  _gtConfig[balde]=metricas;
}
function _gtCloseEditor(){
  const ov=document.getElementById('gt-cfg-overlay'),md=document.getElementById('gt-cfg-modal');
  if(ov)ov.style.display='none';
  if(md)md.style.display='none';
}
async function _gtOpenEditor(){
  if(!hasPermission('module:meta:gestor'))return; // gate = acesso à ferramenta; escrita protegida por RLS (admin OU meta.gestor)
  await _gtLoadConfig();
  const baldes=Object.keys(GT_BALDE_PADRAO);
  const catalogo=Object.entries(GT_METRIC_CATALOG).map(([k,m])=>({k,label:m.label}));
  const body=baldes.map(b=>{
    const sel=_gtMetricasDoBalde(b);
    const chks=catalogo.map(c=>`<label class="gt-cfg-chk"><input type="checkbox" data-balde="${_gtEsc(b)}" value="${_gtEsc(c.k)}" ${sel.includes(c.k)?'checked':''}> ${_gtEsc(c.label)}</label>`).join('');
    return `<div class="gt-cfg-sec"><div class="gt-cfg-obj">${_gtEsc(b)}</div><div class="gt-cfg-grid">${chks}</div></div>`;
  }).join('');
  const bodyEl=document.getElementById('gt-cfg-body');
  if(bodyEl)bodyEl.innerHTML=body;
  const ov=document.getElementById('gt-cfg-overlay'),md=document.getElementById('gt-cfg-modal');
  if(ov)ov.style.display='block';
  if(md)md.style.display='flex';
}
async function _gtSaveEditor(){
  const btn=document.getElementById('gt-cfg-save-btn');
  const orig=btn?btn.textContent:'';
  if(btn){btn.disabled=true;btn.textContent='Salvando...';}
  try{
    const baldes=Object.keys(GT_BALDE_PADRAO);
    const catalogOrder=Object.keys(GT_METRIC_CATALOG);
    for(const b of baldes){
      const checked=Array.from(document.querySelectorAll('#gt-cfg-body input[type=checkbox][data-balde="'+b+'"]:checked')).map(i=>i.value);
      const keys=catalogOrder.filter(k=>checked.includes(k));
      await _gtSaveConfig(b,keys);
    }
    _gtCloseEditor();
    adminToast('Configuração de métricas salva');
    await loadGtData();
  }catch(e){
    adminToast('Erro ao salvar: '+String((e&&e.message)||e||'erro desconhecido'),false);
  }finally{
    if(btn){btn.disabled=false;btn.textContent=orig;}
  }
}
async function loadGtData(){
  const col=document.getElementById('gt-camp-col');
  if(!col)return;
  if(!_gtCurAcc){col.innerHTML='<div class="gt-camp-card"><div class="gt-empty">Nenhuma conta selecionada.</div></div>';return;}
  col.innerHTML='<div class="gv-loading-screen"><div class="gv-spinner"></div><span class="gv-loading-lbl">Carregando campanhas</span></div>';
  // Reset AI suggestions
  const sugs=document.getElementById('gt-suggestions');
  if(sugs)sugs.innerHTML='';
  try{
    if(!_gtConfigLoaded){ await _gtLoadConfig(); _gtConfigLoaded=true; }
    await _gtLoadBudgetIA();
    await _gtLoadAdIA();
    const acc=_gtCurAcc;
    const tok=acc.id;
    const adAccId=acc.ad_account_id;
    // Janela de datas — sempre em BRT (ver src/compartilhado/datas.js).
    // Antes usava toISOString() (UTC): das 21h à meia-noite "HOJE" pedia a data de
    // amanhã e o board vinha vazio, como se ninguém tivesse gasto nada.
    let since,until;
    const _gt=hojeLocal();
    if(_gtPreset==='today'){since=_gt;until=_gt;}
    else if(_gtPreset==='1d'){since=until=diasAtras(1);}
    else if(_gtPreset==='lastmonth'){since=primeiroDiaDoMes(-1);until=ultimoDiaDoMes(-1);}
    else if(_gtPreset==='monthfull'||_gtPreset==='sofar'){since=primeiroDiaDoMes();until=_gt;}
    else{const n=parseInt(_gtPreset)||30;since=diasAtras(n);until=_gt;}
    const fields='campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc,reach,frequency,actions,action_values,purchase_roas,objective,video_play_actions';
    const adFields='campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,impressions,clicks,spend,ctr,cpc,reach,frequency,actions,objective';
    const campFields='id,name,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time,bid_strategy';
    // Conjuntos de anúncios (ad sets): é aqui que mora o orçamento quando a
    // campanha é ABO. Sem isto não dá pra saber se é ABO ou CBO nem editar o
    // orçamento no nível certo.
    const setFields='id,name,effective_status,daily_budget,lifetime_budget,campaign_id';
    const timeRange={since,until};
    const [insights,campaigns,adInsights,adObjs,adsets]=await Promise.all([
      metaFetchAll(`/act_${_maCleanAccId(adAccId)}/insights`,{level:'campaign',fields,filtering:JSON.stringify([{field:'spend',operator:'GREATER_THAN',value:'0'}]),time_range:timeRange},tok).catch(()=>[]),
      metaFetchAll(`/act_${_maCleanAccId(adAccId)}/campaigns`,{fields:campFields,effective_status:JSON.stringify(['ACTIVE','PAUSED','ARCHIVED'])},tok).catch(()=>[]),
      metaFetchAll(`/act_${_maCleanAccId(adAccId)}/insights`,{level:'ad',fields:adFields,filtering:JSON.stringify([{field:'spend',operator:'GREATER_THAN',value:'0'}]),time_range:timeRange},tok).catch(()=>[]),
      metaFetchAll(`/act_${_maCleanAccId(adAccId)}/ads`,{fields:'id,effective_status'},tok).catch(()=>[]),
      metaFetchAll(`/act_${_maCleanAccId(adAccId)}/adsets`,{fields:setFields,effective_status:JSON.stringify(['ACTIVE','PAUSED','ARCHIVED'])},tok).catch(()=>[]),
    ]);
    // Attach real effective_status to each ad insight (insights endpoint doesn't return status)
    const adStatusMap={};adObjs.forEach(a=>{adStatusMap[a.id]=a.effective_status||'';});
    adInsights.forEach(a=>{a.effective_status=adStatusMap[a.ad_id]||'';});
    _gtCampaigns=campaigns;_gtInsights=insights;_gtAdInsights=adInsights;_gtAdsets=adsets;
    _gtLastLoadTime=new Date();updateGtUpdateStatus();
    if(_gtStatusTimer)clearInterval(_gtStatusTimer);
    _gtStatusTimer=setInterval(updateGtUpdateStatus,60000);
    _renderGtCampaigns(col,campaigns,insights,adInsights,adsets);
    // Reset AI analyze button
    const btn=document.getElementById('gt-analyze-btn');
    if(btn){btn.disabled=false;btn.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Analisar com Agente IA';}
  }catch(e){
    col.innerHTML=`<div class="gt-camp-card"><div class="gt-empty">Erro ao carregar dados:<br>${e.message}</div></div>`;
  }
}
// Botão manual de pausar/reativar SEMPRE disponível, independente do veredito.
// kind='campaign'|'ad'. Retorna o <button> ou null (para status sem toggle).
function _gtManualToggleBtn(kind,id,status,nome){
  const nm=_gtEsc(nome||(kind==='ad'?'o anúncio':'a campanha'));
  let action=null;
  if(status==='ACTIVE'){
    action=kind==='ad'
      ?{type:'pause_ad',id,_t:'Pausar anúncio?',_d:`"${nm}" será PAUSADO na Meta agora.`}
      :{type:'pause_campaign',id,_t:'Pausar campanha?',_d:`"${nm}" será PAUSADA na Meta agora.`};
  }else if(status==='PAUSED'){
    action=kind==='ad'
      ?{type:'activate_ad',id,_t:'Ativar anúncio?',_d:`"${nm}" voltará a ATIVO e a gastar na Meta.`}
      :{type:'activate_campaign',id,_t:'Reativar campanha?',_d:`"${nm}" voltará a ATIVA e a gastar na Meta.`};
  }
  if(!action)return null; // ARCHIVED/encerrada: sem toggle
  const b=document.createElement('button');
  b.className='gt-act-btn '+(status==='ACTIVE'?'':'success');
  b.textContent=status==='ACTIVE'?'⏸ Pausar':'▶ Reativar';
  b.style.opacity='.9';
  b.addEventListener('click',e=>{e.stopPropagation();_gtApplyAction(action,b,null);});
  return b;
}
// Campanha "encerrada": ACTIVE no Meta mas com stop_time já no passado.
function _gtEncerrada(camp,nowMs){
  if(!camp||camp.effective_status!=='ACTIVE'||!camp.stop_time)return false;
  const t=Date.parse(camp.stop_time);
  return !Number.isNaN(t)&&t<nowMs;
}
// ── Motor de regras client-side (fallback quando não há análise do Opus) ──
// Espelha os critérios do prompt do Opus. Limiares fixos = preset "equilibrada" (sem postura).
function _gtObjCategory(obj){
  const o=(obj||'').toUpperCase();
  if(o.includes('LEAD'))return'lead';
  if(o.includes('CONVERSION')||o.includes('SALE'))return'conversion';
  if(o.includes('ENGAGEMENT')||o==='POST_ENGAGEMENT'||o==='PAGE_LIKES')return'engagement';
  if(o.includes('VIDEO')||o==='VIDEO_VIEWS')return'video';
  if(o.includes('AWARENESS')||o==='BRAND_AWARENESS'||o==='REACH')return'awareness';
  if(o.includes('TRAFFIC')||o==='LINK_CLICKS')return'traffic';
  return'other';
}
const GT_CRIT={
  minSpend:20,minImpr:1000, freqSat:4,freqAtt:3.5,
  lead:{pausSpend:80,pausImpr:4000,escCTR:2.0,escCPLf:0.85,monCTR:1.5,monSpend:50},
  traffic:{pausCTR:0.5,pausSpend:40,pausImpr:2000,escCTR:2.0,escCPC:2.0,monCTR:1.0,monSpend:40},
  engagement:{pausSpend:60,pausEng:10,pausImpr:2000,escEng:100,escCTR:1.0,monCTR:0.5,monSpend:30},
  video:{monSpend:50,monViews:100,escViews:500,escCTR:0.8},
};
function _gtVerdict(m){
  const C=GT_CRIT,P=_maFmtPct,R=_maFmtR,N=_maFmt;
  if(m.spend<C.minSpend||m.impr<C.minImpr)
    return{kind:'coletando',text:`Volume baixo (${R(m.spend)} · ${N(m.impr)} impressões) — sem recomendação confiável ainda.`};
  if(m.freq>=C.freqSat)
    return{kind:'reduzir',text:`Frequência ${N(m.freq,1)}× — o mesmo público já viu demais. Vale reduzir o orçamento.`};
  if(m.freq>=C.freqAtt)
    return{kind:'monitorar',text:`Frequência ${N(m.freq,1)}× — começando a saturar o público, monitorar.`};
  if(m.cat==='lead'||m.cat==='conversion'){
    const c=C.lead;
    if(m.leads===0&&m.spend>=c.pausSpend&&m.impr>=c.pausImpr)
      return{kind:'pausar',text:`${R(m.spend)} gastos e 0 conversões. Pausar e revisar oferta/segmentação.`};
    if(m.leads>0&&m.ctr>=c.escCTR&&(!m.avgCPL||m.cpl<=m.avgCPL*c.escCPLf))
      return{kind:'escalar',text:`${N(m.leads)} leads · CPL ${R(m.cpl)} (abaixo da média) · CTR ${P(m.ctr)}. Forte — vale escalar.`};
    if(m.leads===0&&m.ctr>=c.monCTR&&m.spend>=c.monSpend)
      return{kind:'monitorar',text:`CTR ${P(m.ctr)} bom, mas 0 conversões — provável gargalo na landing/oferta.`};
    if(m.leads>0)
      return{kind:'saudavel',text:`${N(m.leads)} leads · CPL ${R(m.cpl)} · CTR ${P(m.ctr)}.`};
    return{kind:'monitorar',text:`CTR ${P(m.ctr)} · ${R(m.spend)} — ainda sem conversão, mas dentro da margem.`};
  }
  if(m.cat==='traffic'){
    const c=C.traffic;
    if(m.ctr<c.pausCTR&&m.spend>=c.pausSpend&&m.impr>=c.pausImpr)
      return{kind:'pausar',text:`CTR ${P(m.ctr)} muito baixo com ${R(m.spend)} gastos — clique caro, desperdício.`};
    if(m.ctr>=c.escCTR&&m.cpc>0&&m.cpc<=c.escCPC)
      return{kind:'escalar',text:`CTR ${P(m.ctr)} · CPC ${R(m.cpc)} — clique barato e eficiente. Vale escalar.`};
    if(m.ctr<c.monCTR&&m.spend>=c.monSpend)
      return{kind:'monitorar',text:`CTR ${P(m.ctr)} fraco para tráfego — testar criativo ou segmentação.`};
    return{kind:'saudavel',text:`${N(m.clicks)} cliques · CTR ${P(m.ctr)} · CPC ${R(m.cpc)}.`};
  }
  if(m.cat==='engagement'){
    const c=C.engagement;
    if(m.spend>=c.pausSpend&&m.eng<c.pausEng&&m.impr>=c.pausImpr)
      return{kind:'pausar',text:`${R(m.spend)} gastos e só ${N(m.eng)} engajamentos — o criativo não está conectando.`};
    if(m.eng>=c.escEng&&m.ctr>=c.escCTR)
      return{kind:'escalar',text:`${N(m.eng)} engajamentos · CTR ${P(m.ctr)} — boa tração. Considere escalar.`};
    if(m.ctr<c.monCTR&&m.spend>=c.monSpend)
      return{kind:'monitorar',text:`CTR ${P(m.ctr)} baixo para engajamento — o criativo pode não estar conectando.`};
    return{kind:'saudavel',text:`${N(m.eng)} engajamentos · CTR ${P(m.ctr)} · ${R(m.spend)}.`};
  }
  if(m.cat==='video'){
    const c=C.video;
    if(m.spend>=c.monSpend&&m.views<c.monViews)
      return{kind:'monitorar',text:`Poucos plays (${N(m.views)}) com ${R(m.spend)} gastos — o hook do vídeo pode estar fraco.`};
    if(m.views>=c.escViews&&m.ctr>=c.escCTR)
      return{kind:'escalar',text:`${N(m.views)} plays · CTR ${P(m.ctr)} — boa tração para o vídeo.`};
    return{kind:'saudavel',text:`${N(m.views)} plays · CTR ${P(m.ctr)} · ${R(m.spend)}.`};
  }
  if(m.cat==='awareness')
    return{kind:'saudavel',text:`${N(m.reach)} alcance · Frequência ${N(m.freq,1)}× · ${R(m.spend)}.`};
  return{kind:'saudavel',text:`CTR ${P(m.ctr)} · ${R(m.spend)} gastos.`};
}
// Recomendação de CAMPANHA por regra — mesma forma da linha do Opus.
function _gtRegraCampanha(camp,ins,allInsights){
  const daily=camp&&camp.daily_budget?parseFloat(camp.daily_budget)/100:null;
  const m={
    cat:_gtObjCategory(ins.objective||(camp&&camp.objective)||''),
    ctr:parseFloat(ins.ctr||0),spend:parseFloat(ins.spend||0),impr:parseInt(ins.impressions||0),
    freq:parseFloat(ins.frequency||0),clicks:parseInt(ins.clicks||0),cpc:parseFloat(ins.cpc||0),
    leads:_getActions(ins,'lead'),eng:(_getActions(ins,'post_engagement')||_getActions(ins,'page_engagement')),
    views:parseInt((ins.video_play_actions&&ins.video_play_actions[0]&&ins.video_play_actions[0].value)||0),
    reach:parseInt(ins.reach||0),daily,
  };
  m.cpl=m.leads>0?m.spend/m.leads:null;
  const arr=allInsights||[];
  const totS=arr.reduce((s,i)=>s+parseFloat(i.spend||0),0),totL=arr.reduce((s,i)=>s+_getActions(i,'lead'),0);
  m.avgCPL=totL>0?totS/totL:null;
  const v=_gtVerdict(m);
  const veredito=v.kind==='escalar'?'escalar':v.kind==='reduzir'?'reduzir':v.kind==='pausar'?'pausar':'manter';
  let bud=null;
  if(daily!=null){const f=veredito==='escalar'?1.25:veredito==='reduzir'?0.75:1;bud=Math.round(daily*f*100);}
  return { veredito, budget_sugerido_centavos: bud, justificativa: v.text };
}
// Recomendação de ANÚNCIO por regra — manter/pausar (mesma forma da linha do Opus por anúncio).
function _gtRegraAnuncio(ad){
  const ctr=parseFloat(ad.ctr||0),spend=parseFloat(ad.spend||0),impr=parseInt(ad.impressions||0),freq=parseFloat(ad.frequency||0);
  if(freq>=4)return{veredito:'pausar',justificativa:`Frequência ${_maFmt(freq,1)}× — criativo com fadiga.`};
  if(ctr<0.3&&spend>15&&impr>1000)return{veredito:'pausar',justificativa:`CTR crítico ${_maFmtPct(ctr)} com ${_maFmtR(spend)} gastos — desperdiçando budget.`};
  if(ctr<0.5&&spend>30)return{veredito:'pausar',justificativa:`CTR ${_maFmtPct(ctr)} baixo — substituir ou pausar o criativo.`};
  return{veredito:'manter',justificativa:`CTR ${_maFmtPct(ctr)} · ${_maFmtR(spend)}.`};
}
// Faixa de recomendação da IA (estrela do cartão). Trata todos os estados.
function _gtRecBanner(iaRow,daily,encerrada,status){
  const dfmt=daily!=null?_maFmtR(daily):null;
  if(!iaRow){
    return `<div class="gt-rec-banner neutral"><div class="gt-rec-main"><div class="gt-rec-head"><span class="gt-rec-verdict">Análise em breve</span></div><div class="gt-rec-just">O robô avalia as campanhas toda semana.</div></div></div>`;
  }
  const quando=iaRow.gerado_em?new Date(iaRow.gerado_em).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}):'';
  const just=_gtEsc(iaRow.justificativa||'');
  const ver=iaRow.veredito||'';
  // Pausada/concluída/arquivada: faixa neutra com a última análise apagada, sem ação.
  if(encerrada||status!=='ACTIVE'){
    return `<div class="gt-rec-banner neutral"><div class="gt-rec-main"><div class="gt-rec-head"><span class="gt-rec-tag">✦ IA</span></div><div class="gt-rec-just">${just}</div></div></div>`;
  }
  const varClass=ver==='pausar'?'pausar':ver==='reduzir'?'reduzir':'positivo';
  const sug=iaRow.budget_sugerido_centavos!=null?_maFmtR(iaRow.budget_sugerido_centavos/100):null;
  let action='';
  if(ver==='escalar'||ver==='reduzir'){
    const fromTo=(dfmt&&sug)?`<span class="gt-rec-from">${dfmt}/dia</span><span class="gt-rec-arrow">→</span><span class="gt-rec-to">${sug}<small>/dia</small></span>`:'';
    action=`<div class="gt-rec-action">${fromTo}${sug?`<button data-gt-aplicar="1" class="gt-act-btn primary">Aplicar ${sug}/dia</button>`:''}</div>`;
  }else if(ver==='manter'){
    action=`<div class="gt-rec-action"><span class="gt-rec-keep">Manter ${dfmt?dfmt+'/dia':'orçamento atual'}</span></div>`;
  }else if(ver==='pausar'){
    action=`<div class="gt-rec-action"><button data-gt-pausar="1" class="gt-act-btn danger">⏸ Pausar campanha</button></div>`;
  }
  return `<div class="gt-rec-banner ${varClass}">
    <div class="gt-rec-main">
      <div class="gt-rec-head"><span class="gt-rec-verdict">${_gtEsc(ver)}</span><span class="gt-rec-tag">✦ IA</span></div>
      <div class="gt-rec-just">${just}</div>
      ${iaRow.impacto_estimado?`<div class="gt-rec-impact"><b>Impacto:</b> ${_gtEsc(iaRow.impacto_estimado)}</div>`:''}
    </div>
    ${action}
  </div>`;
}

// Controle de edição manual de orçamento — serve tanto pra CAMPANHA (CBO)
// quanto pra CONJUNTO de anúncios (ABO). Quem decide se é editável é o módulo
// puro (podeEditarOrcamentoDa*); aqui só se desenha o veredito dele.
// perm: {editavel,motivo}; orc: orcamentoDe(entidade) ou null.
function _gtBudgetEditHtml(perm,orc){
  const valor=orc
    ?(orc.tipo==='diario'?`<b>${_maFmtR(orc.reais)}/dia</b>`:`<b>${_maFmtR(orc.reais)}</b> no total`)
    :null;
  if(perm&&perm.editavel){
    return `<div class="gt-budget-edit">
      <span class="gt-be-cur">Orçamento: ${valor}</span>
      <button data-gt-edit-toggle="1" class="gt-be-link">✎ editar</button>
      <span data-gt-edit-box="1" class="gt-be-box" hidden>
        <input data-gt-manual="1" type="number" min="1" step="1" placeholder="R$/dia">
        <button data-gt-manual-ok="1" class="gt-act-btn primary" style="font-size:calc(10px*var(--gt-fs,1.3));">Aplicar</button>
      </span>
    </div>`;
  }
  const nota=perm&&perm.motivo?`<span class="gt-be-nota">${_gtEsc(perm.motivo)}</span>`:'';
  if(!valor&&!nota)return '';
  return `<div class="gt-budget-edit">${valor?`<span class="gt-be-cur">Orçamento: ${valor}</span>`:''}${nota}</div>`;
}
// Liga o par "✎ editar" + "Aplicar" dentro de `el`. Vale pra campanha e pra
// conjunto — muda só o id do alvo e o texto da confirmação.
// alvo: {id, nome, atualReais, nivelLbl:'da campanha'|'do conjunto', nivelNome:'Campanha'|'Conjunto'}
function _gtWireBudgetManual(el,alvo){
  if(!el||!alvo)return;
  const tgl=el.querySelector('[data-gt-edit-toggle]'),box=el.querySelector('[data-gt-edit-box]');
  if(tgl&&box)tgl.addEventListener('click',ev=>{ev.stopPropagation();box.hidden=!box.hidden;if(!box.hidden){const i=box.querySelector('[data-gt-manual]');if(i)i.focus();}});
  const inp=el.querySelector('[data-gt-manual]'),bMan=el.querySelector('[data-gt-manual-ok]');
  if(!bMan||!inp)return;
  bMan.addEventListener('click',ev=>{ev.stopPropagation();
    const v=parseFloat(inp.value);
    if(!Number.isFinite(v)||v<=0){inp.style.borderColor='var(--red)';return;}
    inp.style.borderColor='';
    const cent=Math.round(v*100);
    const antes=alvo.atualReais!=null?_maFmtR(alvo.atualReais)+'/dia':'orçamento atual';
    // ANTES → DEPOIS explícito: é dinheiro real saindo da conta do dono.
    _gtApplyAction({type:'update_budget',id:alvo.id,budget:cent,
      _t:`Aplicar orçamento ${alvo.nivelLbl}?`,
      _d:`${alvo.nivelNome} "${_gtEsc(alvo.nome)}":<br><b>${antes}</b> → <b>${_maFmtR(v)}/dia</b>`},bMan,el);
  });
}
function _gtWireBudgetControls(el,ins,camp,iaRow,permCamp){
  if(!el)return;
  const nm=_gtEsc(ins.campaign_name||camp?.name||'a campanha');
  const daily=camp?.daily_budget?parseFloat(camp.daily_budget)/100:null;
  const bAplicar=el.querySelector('[data-gt-aplicar]');
  // Sendo ABO, o orçamento não é da campanha: aplicar a sugestão da IA aqui
  // levaria recusa da Meta. Some com o botão em vez de oferecer um caminho
  // que não funciona — a nota abaixo do cabeçalho manda pro conjunto certo.
  if(bAplicar&&permCamp&&!permCamp.editavel){bAplicar.remove();}
  else if(bAplicar&&iaRow&&iaRow.budget_sugerido_centavos!=null){
    bAplicar.addEventListener('click',ev=>{ev.stopPropagation();
      const novo=iaRow.budget_sugerido_centavos;
      _gtApplyAction({type:'update_budget',id:ins.campaign_id,budget:novo,_t:'Aplicar budget sugerido?',_d:`"${nm}": ${daily!=null?_maFmtR(daily)+'/dia':'orçamento atual'} → ${_maFmtR(novo/100)}/dia (sugestão da IA).`},bAplicar,el);
    });
  }
  const bPausar=el.querySelector('[data-gt-pausar]');
  if(bPausar){
    bPausar.addEventListener('click',ev=>{ev.stopPropagation();
      _gtApplyAction({type:'pause_campaign',id:ins.campaign_id,_t:'Pausar campanha?',_d:`"${nm}" será PAUSADA na Meta agora.`},bPausar,el);
    });
  }
  // Edição manual da campanha: mesma mecânica do conjunto (helper compartilhado).
  _gtWireBudgetManual(el,{id:ins.campaign_id,nome:ins.campaign_name||camp?.name||'a campanha',atualReais:daily,nivelLbl:'da campanha',nivelNome:'Campanha'});
}
function _renderGtCampaigns(col,campaigns,insights,adInsights,adsets){
  const campMap={};campaigns.forEach(c=>campMap[c.id]=c);
  const adByCamp={};adInsights.forEach(a=>{if(!adByCamp[a.campaign_id])adByCamp[a.campaign_id]=[];adByCamp[a.campaign_id].push(a);});
  // Conjuntos por campanha — é o que permite saber se o orçamento é da
  // campanha (CBO) ou dos conjuntos (ABO) e mostrar a camada do meio.
  const setsByCamp={};(adsets||[]).forEach(s=>{const k=String(s.campaign_id||'');if(!setsByCamp[k])setsByCamp[k]=[];setsByCamp[k].push(s);});
  const sorted=[...insights].sort((a,b)=>parseFloat(b.spend||0)-parseFloat(a.spend||0));
  const card=document.createElement('div');card.className='gt-camp-card';
  const hdr=document.createElement('div');hdr.className='gt-camp-hdr';
  const ttlWrap=document.createElement('div');ttlWrap.style.cssText='display:flex;align-items:center;gap:10px;';
  const ttl=document.createElement('div');ttl.style.cssText='font-family:var(--fonte-principal);font-size:calc(12px*var(--gt-fs,1.3));font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--text);';
  ttl.textContent=sorted.length+' Campanhas';
  const aiTag=document.createElement('div');
  aiTag.style.cssText='font-family:var(--fonte-principal);font-size:calc(9px*var(--gt-fs,1.3));font-weight:700;letter-spacing:.5px;padding:2px 7px;border-radius:20px;background:rgba(99,102,241,.1);color:#6366f1;text-transform:uppercase;';
  aiTag.textContent='✦ IA em tempo real';
  ttlWrap.appendChild(ttl);ttlWrap.appendChild(aiTag);
  const searchInp=document.createElement('input');
  searchInp.type='text';searchInp.placeholder='Buscar campanha…';
  searchInp.style.cssText='padding:6px 10px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text);font-family:var(--fonte-principal);font-size:calc(11px*var(--gt-fs,1.3));outline:none;width:180px;transition:border-color .15s;';
  searchInp.addEventListener('focus',()=>searchInp.style.borderColor='var(--accent)');
  searchInp.addEventListener('blur',()=>searchInp.style.borderColor='var(--border)');
  // Status filter buttons
  const filterWrap=document.createElement('div');filterWrap.style.cssText='display:flex;gap:4px;flex-shrink:0;';
  const filterDefs=[{v:'all',l:'Todas'},{v:'active',l:'Ativas'},{v:'inactive',l:'Inativas'}];
  const filterBtns={};
  filterDefs.forEach(fd=>{
    const fb=document.createElement('button');
    fb.textContent=fd.l;
    const isActive=_gtStatusFilter===fd.v;
    fb.style.cssText=`font-family:var(--fonte-principal);font-size:calc(10px*var(--gt-fs,1.3));font-weight:600;padding:4px 10px;border-radius:5px;cursor:pointer;transition:all .15s;letter-spacing:.3px;border:1px solid ${isActive?'var(--accent)':'var(--border)'};background:${isActive?'var(--accent-light)':'none'};color:${isActive?'var(--accent)':'var(--muted)'};`;
    fb.addEventListener('click',()=>{
      _gtStatusFilter=fd.v;
      Object.entries(filterBtns).forEach(([k,b])=>{
        const on=k===fd.v;
        b.style.borderColor=on?'var(--accent)':'var(--border)';
        b.style.background=on?'var(--accent-light)':'none';
        b.style.color=on?'var(--accent)':'var(--muted)';
      });
      renderList(searchInp.value);
    });
    filterBtns[fd.v]=fb;filterWrap.appendChild(fb);
  });
  // Recolher/expandir TUDO (conjuntos e anúncios de todas as campanhas).
  // _gtRecolhido é lembrado entre redesenhos: quem recolheu tudo não vê
  // tudo abrir de novo a cada ↻ ou troca de filtro.
  const collapseBtn=document.createElement('button');
  collapseBtn.className='gt-collapse-all';
  collapseBtn.type='button';
  const pintaCollapse=()=>{
    collapseBtn.textContent=_gtRecolhido?'⊞ Expandir tudo':'⊟ Recolher tudo';
    collapseBtn.title=_gtRecolhido
      ?'Abrir os conjuntos de anúncios e os anúncios de todas as campanhas'
      :'Fechar os conjuntos de anúncios e os anúncios de todas as campanhas';
  };
  pintaCollapse();
  collapseBtn.addEventListener('click',()=>{
    _gtRecolhido=!_gtRecolhido;
    pintaCollapse();
    // Aplica no que já está na tela, sem refazer as chamadas à Meta.
    card.querySelectorAll('.gt-camp-row-ads,.gt-set-pane').forEach(p=>{
      p.classList.toggle('open',!_gtRecolhido);
      if(!_gtRecolhido&&!p.dataset.loaded&&p.__gtRender){p.dataset.loaded='1';p.__gtRender();}
    });
    card.querySelectorAll('.gt-chevron,.gt-set-chevron').forEach(c=>c.classList.toggle('open',!_gtRecolhido));
  });
  const hdrRight=document.createElement('div');hdrRight.style.cssText='display:flex;align-items:center;gap:8px;flex-wrap:wrap;';
  hdrRight.appendChild(collapseBtn);hdrRight.appendChild(filterWrap);hdrRight.appendChild(searchInp);
  hdr.appendChild(ttlWrap);hdr.appendChild(hdrRight);
  card.appendChild(hdr);
  const list=document.createElement('div');list.className='gt-camp-list';card.appendChild(list);
  const tok=_gtCurAcc?.id;
  function renderList(q){
    list.innerHTML='';
    const filtered=sorted.filter(ins=>{
      if(q&&!(ins.campaign_name||'').toLowerCase().includes(q.toLowerCase()))return false;
      const st=campMap[ins.campaign_id]?.effective_status||'';
      if(_gtStatusFilter==='active')return st==='ACTIVE';
      if(_gtStatusFilter==='inactive')return st==='PAUSED'||st==='ARCHIVED';
      return true;
    });
    if(!filtered.length){list.innerHTML='<div class="gt-empty">Nenhuma campanha encontrada</div>';return;}
    filtered.forEach((ins,i)=>{
      const camp=campMap[ins.campaign_id];
      const status=camp?.effective_status||'';
      const encerrada=_gtEncerrada(camp,Date.now());
      const statusColor=status==='ACTIVE'?'#16a34a':status==='PAUSED'?'#f59e0b':'#6b7280';
      const spend=parseFloat(ins.spend||0);
      const daily=camp?.daily_budget?parseFloat(camp.daily_budget)/100:null;
      const ads=adByCamp[ins.campaign_id]||[];
      // Onde mora o orçamento desta campanha? (módulo puro, testado)
      const conjuntos=setsByCamp[String(ins.campaign_id)]||[];
      const nivelOrc=detectarNivelOrcamento(camp,conjuntos);
      const hier=montarHierarquia(conjuntos,ads);
      const kpiObjective=ins.objective||camp?.objective||'';
      const row=document.createElement('div');row.className='gt-camp-row';
      const inner=document.createElement('div');inner.className='gt-camp-inner';
      // Top line
      const top=document.createElement('div');top.className='gt-camp-top';
      // Status badge
      const badge=document.createElement('div');
      const badgeCls=encerrada?'inactive':(status==='ACTIVE'?'active':status==='PAUSED'?'paused':'inactive');
      const badgeLbl=encerrada?'Concluído':(status==='ACTIVE'?'Ativo':status==='PAUSED'?'Pausado':status==='ARCHIVED'?'Arquivado':'Inativo');
      badge.className=`gt-status-badge ${badgeCls}`;badge.textContent=badgeLbl;
      const nm=document.createElement('div');nm.className='gt-name';nm.title=ins.campaign_name||'';nm.textContent=ins.campaign_name||'—';
      const chips=document.createElement('div');chips.style.cssText='display:flex;align-items:center;gap:8px;flex-shrink:0;';
      // Selo de ONDE fica o orçamento — em português, com a sigla entre parênteses.
      const selo=nivelOrc.sigla
        ?`<span class="gt-nivel-chip ${nivelOrc.sigla==='CBO'?'cbo':'abo'}" title="${_gtEsc(nivelOrc.explicacao)}">${nivelOrc.sigla==='CBO'?'Orçamento na campanha (CBO)':'Orçamento nos conjuntos (ABO)'}</span>`
        :'';
      chips.innerHTML=`<span class="ma-obj-chip" style="font-size:calc(9px*var(--gt-fs,1.3));">${_maObjLabel(ins.objective)}</span>${selo}${daily?`<span style="font-family:var(--fonte-principal);font-size:calc(10px*var(--gt-fs,1.3));font-weight:600;color:var(--muted);">${_maFmtR(daily)}/dia</span>`:''}`;
      // KPIs por objetivo (balde da campanha — ver GT_METRIC_CATALOG/_gtBalde)
      const metrics=document.createElement('div');metrics.className='gt-metrics';
      metrics.innerHTML=_gtKpisHtml(Object.assign({},ins,{objective:kpiObjective}));
      const spendEl=document.createElement('div');spendEl.className='gt-spend';spendEl.textContent=_maFmtR(spend);
      const adCount=ads.length;
      const setCount=hier.length;
      const hint=document.createElement('span');hint.className='gt-expand-hint';
      // Agora a expansão mostra CONJUNTOS → anúncios, então o rótulo conta os dois.
      hint.textContent=setCount>0
        ?`${setCount} conjunto${setCount!==1?'s':''} · ${adCount} anúncio${adCount!==1?'s':''}  ▾`
        :'sem conjuntos';
      const chev=document.createElement('svg');chev.setAttribute('class','gt-chevron');chev.setAttribute('width','12');chev.setAttribute('height','12');chev.setAttribute('viewBox','0 0 24 24');chev.setAttribute('fill','none');chev.setAttribute('stroke','currentColor');chev.setAttribute('stroke-width','2.5');chev.setAttribute('stroke-linecap','round');chev.setAttribute('stroke-linejoin','round');chev.innerHTML='<polyline points="9 18 15 12 9 6"/>';
      const l1=document.createElement('div');l1.className='gt-camp-l1';
      const numEl=document.createElement('div');numEl.className='gt-camp-num';numEl.textContent=String(i+1).padStart(2,'0');
      l1.appendChild(numEl);l1.appendChild(badge);l1.appendChild(nm);l1.appendChild(spendEl);
      const l2=document.createElement('div');l2.className='gt-camp-l2';
      const exp=document.createElement('div');exp.className='gt-camp-exp';exp.appendChild(hint);exp.appendChild(chev);
      l2.appendChild(chips);l2.appendChild(metrics);l2.appendChild(exp);
      top.appendChild(l1);top.appendChild(l2);
      const iaRow=_gtBudgetIA[ins.campaign_id] || ((!encerrada&&status==='ACTIVE')?_gtRegraCampanha(camp,ins,insights):null);
      // 1) Faixa de recomendação (estrela) — no TOPO, antes do cabeçalho.
      const bannerWrap=document.createElement('div');
      bannerWrap.innerHTML=_gtRecBanner(iaRow,daily,encerrada,status);
      if(bannerWrap.firstElementChild)inner.appendChild(bannerWrap.firstElementChild);
      // 2) Cabeçalho de apoio (clicável p/ expandir anúncios).
      inner.appendChild(top);
      // 3) Orçamento da campanha. Só oferece edição quando o orçamento é MESMO
      // da campanha (CBO). Sendo ABO, mostra por que não dá e manda pro
      // conjunto — antes a tela oferecia o campo, o Meta recusava e o dono
      // ficava sem saber onde mexer.
      const permCamp=podeEditarOrcamentoDaCampanha(camp,conjuntos);
      if(!encerrada){
        const beWrap=document.createElement('div');
        beWrap.innerHTML=_gtBudgetEditHtml(permCamp,orcamentoDe(camp));
        if(beWrap.firstElementChild)inner.appendChild(beWrap.firstElementChild);
      }
      // 4) Rodapé: pausar/reativar manual. Pula o "Pausar" se a faixa já mostra Pausar (evita botão duplicado).
      const bannerHasPause=!!iaRow&&iaRow.veredito==='pausar'&&!encerrada&&status==='ACTIVE';
      if(!encerrada&&!bannerHasPause){
        const tgl=_gtManualToggleBtn('campaign',ins.campaign_id,status,ins.campaign_name||camp?.name);
        if(tgl){const actBar=document.createElement('div');actBar.className='gt-action-row';actBar.appendChild(tgl);inner.appendChild(actBar);}
      }
      // 5) Liga os controles (aplicar sugerido, pausar da faixa, editar manual).
      _gtWireBudgetControls(inner,ins,camp,iaRow,permCamp);
      // Painel dos CONJUNTOS (que por sua vez trazem os anúncios dentro).
      const adsPane=document.createElement('div');adsPane.className='gt-camp-row-ads';
      adsPane.__gtRender=()=>_renderGtConjuntos(adsPane,hier,camp,conjuntos,nivelOrc,i+1);
      top.addEventListener('click',()=>{
        const isOpen=adsPane.classList.toggle('open');
        chev.classList.toggle('open',isOpen);
        if(isOpen&&!adsPane.dataset.loaded){
          adsPane.dataset.loaded='1';
          adsPane.__gtRender();
        }
      });
      row.appendChild(inner);row.appendChild(adsPane);
      // Aberto por padrão (como já era), a menos que o dono tenha recolhido tudo.
      if(hier.length&&!_gtRecolhido){ adsPane.classList.add('open'); chev.classList.add('open'); adsPane.dataset.loaded='1'; adsPane.__gtRender(); }
      list.appendChild(row);
    });
  }
  searchInp.addEventListener('input',()=>renderList(searchInp.value));
  renderList('');
  col.innerHTML='';col.appendChild(card);
}
function _gtCrEsc(e){if(e.key==='Escape')_gtCloseCriativo();}
function _gtCloseCriativo(){const ov=document.getElementById('gt-cr-overlay'),md=document.getElementById('gt-cr-modal'),bd=document.getElementById('gt-cr-body');if(ov)ov.style.display='none';if(md)md.style.display='none';if(bd)bd.innerHTML='';document.removeEventListener('keydown',_gtCrEsc);}
async function _gtVerCriativo(adId,accId,nome){
  const ov=document.getElementById('gt-cr-overlay'),md=document.getElementById('gt-cr-modal'),bd=document.getElementById('gt-cr-body');
  if(!ov||!md||!bd)return;
  ov.style.display='block';md.style.display='flex';
  const tt=document.getElementById('gt-cr-title');if(tt)tt.textContent=nome?('Criativo · '+nome):'Criativo do anúncio';
  document.addEventListener('keydown',_gtCrEsc);
  bd.innerHTML='<div style="padding:40px 20px;text-align:center;color:var(--muted);font-family:var(--fonte-principal);font-size:calc(12px*var(--gt-fs,1.3));">Carregando o criativo…</div>';
  // Ordem de formatos confirmada na validação ao vivo (mais provável primeiro).
  const formats=['INSTAGRAM_STANDARD','INSTAGRAM_REELS','INSTAGRAM_STORY','MOBILE_FEED_STANDARD','FACEBOOK_STORY_MOBILE'];
  for(const fmt of formats){
    try{
      const r=await metaFetch('/'+adId+'/previews',{ad_format:fmt},accId);
      const body=r&&r.data&&r.data[0]&&r.data[0].body;
      if(body&&/<iframe/i.test(body)){ bd.innerHTML='<div class="gt-cr-frame">'+body+'</div>'; return; }
    }catch(e){}
  }
  bd.innerHTML='<div style="padding:30px 20px;text-align:center;color:var(--muted);font-family:var(--fonte-principal);font-size:calc(12px*var(--gt-fs,1.3));line-height:1.6;">Não consegui carregar o preview deste anúncio agora.<br>Pode ser um formato sem preview disponível.</div>';
}
// Camada do meio: campanha → CONJUNTOS DE ANÚNCIOS → anúncios.
// É aqui que se edita o orçamento quando a campanha é ABO (orçamento no
// conjunto). hier vem do módulo puro (montarHierarquia).
function _renderGtConjuntos(pane,hier,camp,conjuntos,nivelOrc,campNum){
  const lbl=document.createElement('div');lbl.className='gt-ads-section-lbl';
  lbl.textContent=`Conjuntos de anúncios (${hier.length})`;
  pane.appendChild(lbl);
  if(!hier.length){
    const empty=document.createElement('div');empty.className='gt-set-empty';
    empty.textContent='Nenhum conjunto de anúncios com gasto neste período';
    pane.appendChild(empty);return;
  }
  // Explica por que os conjuntos não têm campo de orçamento (CBO ou
  // desconhecido). Sendo ABO cada conjunto já mostra o seu, e o cabeçalho da
  // campanha já apontou pra cá — a nota aqui seria repetição.
  if(nivelOrc.nivel!=='conjunto'){
    const nota=document.createElement('div');nota.className='gt-set-nivel-nota';
    nota.textContent=nivelOrc.explicacao;
    pane.appendChild(nota);
  }
  hier.forEach((g,si)=>{
    const num=(campNum!=null?campNum+'.':'')+(si+1);
    const cj=g.conjunto;
    const status=(cj&&cj.effective_status)||'';
    const card=document.createElement('div');card.className='gt-set-card';
    const top=document.createElement('div');top.className='gt-set-top';
    const numEl=document.createElement('div');numEl.className='gt-set-num';numEl.textContent=num;
    const badge=document.createElement('div');
    const cls=status==='ACTIVE'?'active':status==='PAUSED'?'paused':'inactive';
    const bl=status==='ACTIVE'?'Ativo':status==='PAUSED'?'Pausado':status==='ARCHIVED'?'Arquivado':'—';
    badge.className='gt-status-badge '+cls;badge.textContent=bl;
    const nmEl=document.createElement('div');nmEl.className='gt-set-nm';
    nmEl.textContent=g.nome||'—';nmEl.title=g.nome||'';
    const gastoEl=document.createElement('div');gastoEl.className='gt-set-spend';gastoEl.textContent=_maFmtR(g.gasto);
    const qtd=document.createElement('span');qtd.className='gt-expand-hint';
    qtd.textContent=g.anuncios.length?`${g.anuncios.length} anúncio${g.anuncios.length!==1?'s':''}  ▾`:'sem anúncios';
    const chev=document.createElement('svg');chev.setAttribute('class','gt-set-chevron');chev.setAttribute('width','11');chev.setAttribute('height','11');chev.setAttribute('viewBox','0 0 24 24');chev.setAttribute('fill','none');chev.setAttribute('stroke','currentColor');chev.setAttribute('stroke-width','2.5');chev.setAttribute('stroke-linecap','round');chev.setAttribute('stroke-linejoin','round');chev.innerHTML='<polyline points="9 18 15 12 9 6"/>';
    const exp=document.createElement('div');exp.className='gt-set-exp';exp.appendChild(qtd);exp.appendChild(chev);
    top.appendChild(numEl);top.appendChild(badge);top.appendChild(nmEl);top.appendChild(gastoEl);top.appendChild(exp);
    card.appendChild(top);
    // Orçamento DO CONJUNTO — editável só quando é ABO (o módulo puro decide).
    // Só desenha a linha se este conjunto TEM orçamento próprio. Sendo CBO,
    // nenhum conjunto tem, e a nota do painel já explicou que o orçamento é
    // da campanha — repetir isso em cada conjunto seria só barulho.
    const orc=cj?orcamentoDe(cj):null;
    if(orc){
      const perm=podeEditarOrcamentoDoConjunto(camp,cj,conjuntos);
      const beWrap=document.createElement('div');
      beWrap.innerHTML=_gtBudgetEditHtml(perm,orc);
      if(beWrap.firstElementChild){
        const be=beWrap.firstElementChild;
        card.appendChild(be);
        if(perm.editavel)_gtWireBudgetManual(be,{id:g.id,nome:g.nome,atualReais:perm.atualReais,nivelLbl:'do conjunto',nivelNome:'Conjunto'});
      }
    }
    // Anúncios do conjunto.
    const adsPane=document.createElement('div');adsPane.className='gt-set-pane';
    adsPane.__gtRender=()=>_renderGtAds(adsPane,g.anuncios,null,null,num);
    top.addEventListener('click',e=>{
      e.stopPropagation(); // não deixa fechar a campanha inteira ao clicar no conjunto
      const isOpen=adsPane.classList.toggle('open');
      chev.classList.toggle('open',isOpen);
      if(isOpen&&!adsPane.dataset.loaded){adsPane.dataset.loaded='1';adsPane.__gtRender();}
    });
    card.appendChild(adsPane);
    if(g.anuncios.length&&!_gtRecolhido){adsPane.classList.add('open');chev.classList.add('open');adsPane.dataset.loaded='1';adsPane.__gtRender();}
    pane.appendChild(card);
  });
}
function _renderGtAds(pane,ads,allInsights,allAdInsights,campNum){
  const lbl=document.createElement('div');lbl.className='gt-ads-section-lbl';lbl.textContent=`Anúncios (${ads.length})`;pane.appendChild(lbl);
  if(!ads.length){const empty=document.createElement('div');empty.style.cssText='font-family:var(--fonte-principal);font-size:calc(11px*var(--gt-fs,1.3));color:var(--muted);padding:6px 0 6px 20px;';empty.textContent='Nenhum anúncio com gasto neste período';pane.appendChild(empty);return;}
  const sorted=[...ads].sort((a,b)=>parseFloat(b.spend||0)-parseFloat(a.spend||0));
  sorted.forEach((ad,ai)=>{
    const ctr=parseFloat(ad.ctr||0);
    const spend=parseFloat(ad.spend||0);
    const adStatus=ad.effective_status||'';
    const ctrColor=ctr>=2?'var(--green)':ctr<0.8?'var(--red)':'var(--orange)';
    const iaRow=_gtAdIA[ad.ad_id] || ((ad.effective_status==='ACTIVE')?_gtRegraAnuncio(ad):null);
    const card=document.createElement('div');card.className='gt-ad-card';
    const top=document.createElement('div');top.className='gt-ad-top';
    // Selo: pílula do veredito da IA; se não houver análise, cai pro badge de status.
    const seal=document.createElement('div');
    if(iaRow){
      seal.className='gt-ad-pill '+(iaRow.veredito==='pausar'?'pausar':'manter');
      seal.textContent=iaRow.veredito==='pausar'?'Pausar':'Manter';
    }else{
      const cls=adStatus==='ACTIVE'?'active':adStatus==='PAUSED'?'paused':'inactive';
      const lb=adStatus==='ACTIVE'?'Ativo':adStatus==='PAUSED'?'Pausado':adStatus==='ARCHIVED'?'Arquivado':'Inativo';
      seal.className='gt-status-badge '+cls;seal.textContent=lb;
    }
    const nameWrap=document.createElement('div');nameWrap.className='gt-ad-name';
    nameWrap.innerHTML=`<div class="gt-ad-nm">${_gtEsc(ad.ad_name||ad.adset_name||'—')}</div>${ad.adset_name&&ad.ad_name?`<div class="gt-ad-sub">${_gtEsc(ad.adset_name)}</div>`:''}`;
    const metrics=document.createElement('div');metrics.className='gt-metrics';
    metrics.innerHTML=`<div class="gt-metric">CTR <span style="color:${ctrColor}">${_maFmtPct(ctr)}</span></div><div class="gt-metric" style="font-family:var(--fonte-principal);font-size:calc(13px*var(--gt-fs,1.3));font-weight:700;"><span>${_maFmtR(spend)}</span></div>`;
    const adNum=document.createElement('div');adNum.className='gt-ad-num';adNum.textContent=(campNum!=null?campNum+'.':'')+(ai+1);
    top.appendChild(adNum);top.appendChild(seal);top.appendChild(nameWrap);top.appendChild(metrics);
    card.appendChild(top);
    // Porquê da IA (apoio).
    if(iaRow&&iaRow.justificativa){const why=document.createElement('div');why.className='gt-ad-why';why.textContent=iaRow.justificativa;card.appendChild(why);}
    // Ações do anúncio: ver criativo + pausar/reativar manual.
    const actBar=document.createElement('div');actBar.className='gt-action-row';
    const crBtn=document.createElement('button');crBtn.className='gt-act-btn';crBtn.textContent='👁 Ver criativo';
    crBtn.addEventListener('click',e=>{e.stopPropagation();_gtVerCriativo(ad.ad_id,_gtCurAcc&&_gtCurAcc.id,ad.ad_name||ad.adset_name);});
    actBar.appendChild(crBtn);
    const adTgl=_gtManualToggleBtn('ad',ad.ad_id,adStatus,ad.ad_name||ad.adset_name);
    if(adTgl)actBar.appendChild(adTgl);
    card.appendChild(actBar);
    pane.appendChild(card);
  });
}
// escapa texto vindo da Meta (nome de campanha/anúncio, mensagem de erro) antes de ir p/ innerHTML
function _gtEsc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
// Modal de confirmação/aviso. opts:{danger,okOnly,okLabel}. Resolve true (confirmar) / false (cancelar).
// ESTE É O GATE que precede TODA ação de mutação real (_gtApplyAction) — pausar/
// reativar campanha ou anúncio, e mudar orçamento. Preservado intacto/verbatim.
function _gtConfirm(title,detailHtml,opts){
  opts=opts||{};
  return new Promise(resolve=>{
    let ov=document.getElementById('gt-confirm-ov');
    if(!ov){ov=document.createElement('div');ov.id='gt-confirm-ov';ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';document.body.appendChild(ov);}
    ov.innerHTML='';ov.style.display='flex';
    const box=document.createElement('div');
    box.style.cssText='background:var(--surface,#fff);color:var(--text,#111);border-radius:14px;max-width:400px;width:100%;padding:24px;box-shadow:0 24px 60px rgba(0,0,0,.45);font-family:var(--fonte-principal);';
    box.innerHTML='<div style="font-size:calc(16px*var(--gt-fs,1.3));font-weight:800;margin-bottom:9px;">'+title+'</div><div style="font-size:calc(13px*var(--gt-fs,1.3));color:var(--muted,#666);line-height:1.55;margin-bottom:20px;">'+detailHtml+'</div>';
    const bar=document.createElement('div');bar.style.cssText='display:flex;gap:10px;justify-content:flex-end;';
    const close=v=>{ov.style.display='none';resolve(v);};
    if(!opts.okOnly){const c=document.createElement('button');c.textContent='Cancelar';c.style.cssText='padding:9px 16px;border-radius:8px;border:1px solid var(--border,#ddd);background:none;color:var(--text,#111);font-weight:600;font-size:calc(13px*var(--gt-fs,1.3));cursor:pointer;';c.onclick=()=>close(false);bar.appendChild(c);}
    const ok=document.createElement('button');ok.textContent=opts.okLabel||(opts.okOnly?'Entendi':'Confirmar');ok.style.cssText='padding:9px 18px;border-radius:8px;border:none;background:'+(opts.danger?'#dc2626':'var(--accent,#6366f1)')+';color:#fff;font-weight:700;font-size:calc(13px*var(--gt-fs,1.3));cursor:pointer;';ok.onclick=()=>close(true);bar.appendChild(ok);
    box.appendChild(bar);ov.appendChild(box);
    ov.onclick=e=>{if(e.target===ov)close(false);};
  });
}
// AÇÃO REAL na Meta (pausar/reativar campanha ou anúncio, mudar orçamento).
// Toda chamada de metaPost() aqui é precedida por await _gtConfirm(...) — o
// usuário SEMPRE confirma antes de qualquer mutação ser aplicada na conta ao vivo.
async function _gtApplyAction(action,btn,rowEl){
  const tok=_gtCurAcc?.id;
  if(!tok){alert('Sem conta selecionada.');return;}
  const danger=action.type==='pause_campaign'||action.type==='pause_ad';
  const ok=await _gtConfirm(action._t||'Confirmar ação?',action._d||'Esta ação será aplicada na Meta agora.',{danger});
  if(!ok)return;
  const orig=btn.textContent;
  btn.disabled=true;btn.textContent='…';
  try{
    if(action.type==='pause_campaign'||action.type==='activate_campaign')
      await metaPost('/'+action.id,{status:action.type==='pause_campaign'?'PAUSED':'ACTIVE'},tok);
    else if(action.type==='pause_ad'||action.type==='activate_ad')
      await metaPost('/'+action.id,{status:action.type==='pause_ad'?'PAUSED':'ACTIVE'},tok);
    else if(action.type==='update_budget')
      await metaPost('/'+action.id,{daily_budget:String(action.budget)},tok);
    btn.textContent='✓ Aplicado';btn.style.background='#16a34a';btn.style.borderColor='#16a34a';btn.style.color='#fff';
    setTimeout(()=>loadGtData(),1500);
  }catch(e){
    const msg=String((e&&e.message)||e||'');
    // ATENÇÃO ÀS SIGLAS (já foram trocadas aqui uma vez e confundiram o dono):
    // ABO = orçamento NO CONJUNTO de anúncios. CBO = orçamento NA CAMPANHA.
    // "campanha" é testado ANTES: /budget.*level/ casaria com "campaign budget
    // level" e daria a resposta trocada.
    const friendly=/campaign level|campaign budget/i.test(msg)
      ?'O orçamento está na <b>campanha</b> (CBO). Ajuste no nível da campanha, não do conjunto.'
      :/ad ?set|adset|budget.*level|set level/i.test(msg)
      ?'O orçamento está no <b>conjunto de anúncios</b> (ABO). Ajuste no nível do conjunto, não da campanha — abra a campanha e edite no conjunto.'
      :/permiss|#200|#10\b|#272|OAuth|token|management/i.test(msg)
      ?'O token desta conta <b>não tem permissão de gerenciar anúncios</b> (ads_management). Verifique o acesso na Meta.'
      :('<b>Erro da Meta:</b> '+_gtEsc(msg.slice(0,180)));
    btn.disabled=false;btn.textContent=orig;btn.style.color='';btn.style.borderColor='';
    _gtConfirm('Não foi possível aplicar',friendly,{okOnly:true});
  }
}

// Equivalente ao closeGestaoTrafego() do legado (que fazia display:none dos
// dois lados + voltava pro hub). Continua limpando os mesmos timers e o
// listener do dropdown; a troca de tela agora é feita pelo router.
function _gtStopAllTimers(){
  if(_gtClockTimer){clearInterval(_gtClockTimer);_gtClockTimer=null;}
  if(_gtStatusTimer){clearInterval(_gtStatusTimer);_gtStatusTimer=null;}
  _gtLastLoadTime=null;
  document.removeEventListener('click',_gtDocClick);
  document.removeEventListener('keydown',_gtCrEsc);
}
function closeGestaoTrafego(){
  _gtStopAllTimers();
  router.push({ name: 'meta-ads' });
}

// Guarda de acesso (equivalente ao if(!hasPermission('module:meta:gestor'))return;
// do openGestaoTrafego original) + disparo do carregamento inicial (equivalente
// ao resto do openGestaoTrafego original: gate do botão de KPIs, startGtClock,
// _initGestaoTrafego, _gtFontScale).
onMounted(() => {
  if (!hasPermission('module:meta:gestor')) {
    adminToast('Sem acesso', false)
    router.push({ name: 'meta-ads' })
    return
  }
  document.addEventListener('click', _gtDocClick)
  const cfgBtn = document.getElementById('gt-cfg-btn')
  if (cfgBtn) cfgBtn.style.display = hasPermission('meta.gestor', 'editar') ? '' : 'none' // editor de métricas = ação 'editar'
  startGtClock()
  _initGestaoTrafego()
  _gtFontScale()
})
onUnmounted(() => {
  _gtStopAllTimers()
})

// Cluster de funções chamadas via onclick="..." literal no <template> acima.
// Conferido por grep (ver comentário no topo do bloco de script): nenhuma
// outra função _gt*/setGt*/toggleGt* é chamada por onclick="..." dentro do
// HTML gerado em runtime (_renderGtCampaigns/_renderGtAds/_gtRecBanner/
// _buildGtDropdown usam addEventListener ou atribuição direta a .onclick).
Object.assign(window, {
  setGtPeriod,
  toggleGtAccPicker,
  loadGtData,
  _gtOpenEditor,
  _gtCloseEditor,
  _gtSaveEditor,
  _gtCloseCriativo,
})
</script>

<style scoped>
/* Porte das regras #gestao-trafego-screen/.gt-* (Gestão de Tráfego, legacy/
   index.html L2350-2477) + o conjunto "gv-topbar/gv-clock/gv-period-btns"
   compartilhado com Gestão à Vista/Análise de Campanhas (cada tela traz sua
   própria cópia, mesmo padrão já estabelecido) + .ma-obj-chip (usado dentro
   do chip de objetivo renderizado por _renderGtCampaigns) + .zoomctl/
   .zoomctl-val (controle de zoom flutuante A−/A+ que _gtFontScale cria).
   #gestao-trafego-screen vira .tela-gestao-trafego (sem display:none — a
   visibilidade é do router). #gt-camp-col e os dois modais são preenchidos
   via innerHTML/createElement (JS imperativo acima), por isso os seletores
   que miram elementos ali dentro usam :deep(); os IDs do topbar/clock/
   dropdown de conta são literais do <template> (Vue já aplica o escopo
   neles), mas :deep() também funciona e é mantido por consistência com o
   resto do app. */
.tela-gestao-trafego{min-height:100vh;display:flex;flex-direction:column;background:var(--bg);position:relative;z-index:1;--gt-fs:1.3;}

/* ── Topbar (compartilhado com Gestão à Vista/Análise de Campanhas — cada tela traz sua cópia) ── */
.tela-gestao-trafego :deep(.gv-topbar){display:flex;align-items:center;justify-content:space-between;padding:7px 28px;border-bottom:1px solid var(--border);background:var(--surface);position:sticky;top:0;z-index:10;}
.tela-gestao-trafego :deep(.gv-back){display:flex;align-items:center;gap:4px;font-family:var(--fonte-principal);font-size:10px;font-weight:600;color:var(--accent);cursor:pointer;background:none;border:none;padding:0;transition:opacity .15s;letter-spacing:.3px;text-transform:uppercase;}
.tela-gestao-trafego :deep(.gv-back:hover){opacity:.75;}
.tela-gestao-trafego :deep(.gv-brand-tag){font-family:var(--fonte-principal);font-size:10px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:var(--text);opacity:.6;line-height:1;}
.tela-gestao-trafego :deep(.gv-perf-tag){font-family:var(--fonte-principal);font-size:13.5px;font-weight:700;letter-spacing:6px;text-transform:uppercase;color:var(--text);opacity:1;line-height:1.2;}
.tela-gestao-trafego :deep(.gv-clock-wrap){text-align:right;}
.tela-gestao-trafego :deep(.gv-clock-time){font-family:var(--fonte-dados);font-size:28px;font-weight:400;letter-spacing:3px;color:var(--text);line-height:1;}
.tela-gestao-trafego :deep(.gv-clock-date){font-family:var(--fonte-principal);font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-top:3px;}
.tela-gestao-trafego :deep(.gv-update-status){font-family:var(--fonte-principal);font-size:8px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);opacity:.45;margin-top:4px;text-align:right;}
.tela-gestao-trafego :deep(.gv-period-btns){display:flex;align-items:center;gap:4px;}
.tela-gestao-trafego :deep(.gv-pbtn){font-family:var(--fonte-principal);font-size:10px;padding:4px 9px;border-radius:5px;border:1px solid var(--border);background:none;color:var(--muted);cursor:pointer;transition:all .15s;}
.tela-gestao-trafego :deep(.gv-pbtn.active){background:var(--accent);color:#fff;border-color:var(--accent);}

/* ── Loading state (compartilhado com Gestão à Vista/Análise de Campanhas — cada tela traz sua cópia) ── */
.tela-gestao-trafego :deep(.gv-loading-screen){grid-column:1/-1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;min-height:60vh;}
@keyframes gtSpin{to{transform:rotate(360deg)}}
.tela-gestao-trafego :deep(.gv-spinner){width:48px;height:48px;border-radius:50%;border:3px solid var(--border);border-top-color:var(--accent);animation:gtSpin .9s linear infinite;}
.tela-gestao-trafego :deep(.gv-loading-lbl){font-family:var(--fonte-principal);font-size:10px;letter-spacing:4px;text-transform:uppercase;color:var(--muted);opacity:.6;}

/* ── Chip de objetivo (compartilhado com Análise de Campanhas — cada tela traz sua cópia) ── */
.tela-gestao-trafego :deep(.ma-obj-chip){font-family:var(--fonte-principal);font-size:9px;font-weight:600;letter-spacing:.5px;padding:2px 6px;border-radius:3px;background:var(--surface2);color:var(--muted);text-transform:uppercase;}

/* ── GESTÃO DE TRÁFEGO — CSS próprio (legacy/index.html L2350-2477, íntegro) ── */
.tela-gestao-trafego :deep(.gt-body){flex:1;display:flex;flex-direction:column;overflow-y:auto;padding:20px 28px;gap:16px;}
.tela-gestao-trafego :deep(.gt-camp-card){background:none;border:none;border-radius:0;overflow:visible;}
.tela-gestao-trafego :deep(.gt-camp-hdr){padding:2px 4px 14px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}
.tela-gestao-trafego :deep(.gt-camp-list){display:flex;flex-direction:column;gap:14px;}
.tela-gestao-trafego :deep(.gt-camp-row){background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.05);}
/* Campaign inner block */
.tela-gestao-trafego :deep(.gt-camp-inner){padding:13px 22px 10px;}
.tela-gestao-trafego :deep(.gt-camp-top){display:flex;flex-direction:column;gap:0;cursor:pointer;user-select:none;border-radius:8px;padding:7px 8px;margin:-5px -8px;transition:background .12s;}
.tela-gestao-trafego :deep(.gt-camp-top:hover){background:var(--surface2);}
.tela-gestao-trafego :deep(.gt-camp-top:hover .gt-name){color:var(--accent);}
.tela-gestao-trafego :deep(.gt-camp-l1){display:flex;align-items:center;gap:10px;}
.tela-gestao-trafego :deep(.gt-camp-l1 .gt-spend){margin-left:auto;}
.tela-gestao-trafego :deep(.gt-camp-num){font-family:var(--fonte-dados);font-size:calc(14px*var(--gt-fs,1.3));font-weight:600;color:var(--accent);min-width:24px;text-align:center;flex-shrink:0;font-variant-numeric:tabular-nums;letter-spacing:.5px;}
.tela-gestao-trafego :deep(.gt-ad-num){font-family:var(--fonte-dados);font-size:calc(11px*var(--gt-fs,1.3));font-weight:600;color:var(--accent);opacity:.85;flex-shrink:0;font-variant-numeric:tabular-nums;letter-spacing:.3px;}
.tela-gestao-trafego :deep(.gt-camp-l2){display:flex;align-items:center;gap:14px;margin-top:7px;flex-wrap:wrap;}
.tela-gestao-trafego :deep(.gt-camp-exp){margin-left:auto;display:flex;align-items:center;gap:6px;flex-shrink:0;}
.tela-gestao-trafego :deep(.gt-camp-row-ads){padding:0 18px 14px 22px;display:none;flex-direction:column;gap:0;background:var(--surface2);border-top:1px solid var(--border);position:relative;overflow:hidden;}
.tela-gestao-trafego :deep(.gt-camp-row-ads.open){display:flex;}
.tela-gestao-trafego :deep(.gt-ads-section-lbl){font-family:var(--fonte-principal);font-size:calc(9px*var(--gt-fs,1.3));font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);padding:10px 0 6px 20px;opacity:.7;}
/* ── Conjuntos de anúncios (camada entre a campanha e os anúncios) ── */
.tela-gestao-trafego :deep(.gt-set-card){border-radius:9px;background:var(--surface);border:1px solid var(--border);padding:10px 12px;display:flex;flex-direction:column;gap:6px;margin-left:8px;margin-bottom:9px;box-shadow:0 2px 10px rgba(0,0,0,.06);}
.tela-gestao-trafego :deep(.gt-set-top){display:flex;align-items:center;gap:9px;cursor:pointer;min-width:0;}
.tela-gestao-trafego :deep(.gt-set-num){font-family:var(--fonte-dados);font-size:calc(11px*var(--gt-fs,1.3));font-weight:600;color:var(--accent);opacity:.85;flex-shrink:0;font-variant-numeric:tabular-nums;letter-spacing:.3px;}
.tela-gestao-trafego :deep(.gt-set-nm){flex:1;min-width:0;font-family:var(--fonte-principal);font-size:calc(11.5px*var(--gt-fs,1.3));font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.tela-gestao-trafego :deep(.gt-set-spend){font-family:var(--fonte-dados);font-size:calc(13px*var(--gt-fs,1.3));font-weight:700;color:var(--text);flex-shrink:0;font-variant-numeric:tabular-nums;}
.tela-gestao-trafego :deep(.gt-set-exp){display:flex;align-items:center;gap:5px;flex-shrink:0;}
.tela-gestao-trafego :deep(.gt-set-top:hover .gt-expand-hint){opacity:1;color:var(--accent);}
.tela-gestao-trafego :deep(.gt-set-chevron){flex-shrink:0;transition:transform .2s;color:var(--muted);opacity:.55;}
.tela-gestao-trafego :deep(.gt-set-chevron.open){transform:rotate(90deg);}
.tela-gestao-trafego :deep(.gt-set-pane){display:none;flex-direction:column;gap:0;margin-top:2px;}
.tela-gestao-trafego :deep(.gt-set-pane.open){display:flex;}
.tela-gestao-trafego :deep(.gt-set-empty),.tela-gestao-trafego :deep(.gt-set-nivel-nota){font-family:var(--fonte-principal);font-size:calc(10.5px*var(--gt-fs,1.3));color:var(--muted);line-height:1.5;}
.tela-gestao-trafego :deep(.gt-set-empty){padding:6px 0 6px 20px;}
.tela-gestao-trafego :deep(.gt-set-nivel-nota){padding:0 0 9px 8px;opacity:.85;}
/* Selo de onde fica o orçamento: campanha (CBO) x conjuntos (ABO) */
.tela-gestao-trafego :deep(.gt-nivel-chip){font-family:var(--fonte-principal);font-size:calc(9px*var(--gt-fs,1.3));font-weight:700;letter-spacing:.3px;padding:2px 8px;border-radius:20px;white-space:nowrap;flex-shrink:0;cursor:help;}
.tela-gestao-trafego :deep(.gt-nivel-chip.cbo){background:rgba(99,102,241,.12);color:#6366f1;}
.tela-gestao-trafego :deep(.gt-nivel-chip.abo){background:rgba(217,119,6,.12);color:#d97706;}
/* Botão recolher/expandir tudo */
.tela-gestao-trafego :deep(.gt-collapse-all){font-family:var(--fonte-principal);font-size:calc(10px*var(--gt-fs,1.3));font-weight:600;letter-spacing:.3px;padding:4px 10px;border-radius:5px;border:1px solid var(--border);background:none;color:var(--muted);cursor:pointer;white-space:nowrap;flex-shrink:0;transition:all .15s;}
.tela-gestao-trafego :deep(.gt-collapse-all:hover){border-color:var(--accent);color:var(--accent);}
/* Aviso de "não dá pra editar aqui" (ex.: é ABO, edite no conjunto) */
.tela-gestao-trafego :deep(.gt-be-nota){font-size:calc(10.5px*var(--gt-fs,1.3));color:var(--muted);opacity:.9;line-height:1.5;}
.tela-gestao-trafego :deep(.gt-ad-card){border-radius:8px;background:var(--surface);border:1px solid var(--border);padding:11px 14px;display:flex;flex-direction:column;gap:6px;margin-left:20px;margin-bottom:7px;box-shadow:0 2px 8px rgba(0,0,0,.07);position:relative;}
/* GUIA EM ÁRVORE (o fluxograma azul que liga conjunto → anúncios).
 *
 * A versão antiga desenhava um "L" por anúncio com `top: calc(-130%)` e
 * `height: calc(130% + 7px)` — porcentagem da altura do PRÓPRIO card, tentando
 * alcançar a campanha lá em cima. Funcionava por coincidência, enquanto o anúncio
 * ficava direto embaixo da campanha. Quando os CONJUNTOS entraram no meio da
 * hierarquia, a guia passou a subir 130% da própria altura por cima dos cards de
 * conjunto: o fluxograma virou risco atravessado na tela.
 *
 * Agora são duas peças, sem porcentagem e sem atravessar nível:
 *   1. o trilho vertical vive no CONTAINER dos anúncios (gt-set-pane)
 *   2. cada anúncio tem só um "L" curto, de tamanho fixo, que encosta no trilho
 * Assim a guia liga o anúncio ao SEU conjunto — que é a relação real — e nada
 * depende da altura dos cards.
 */
.tela-gestao-trafego :deep(.gt-set-pane){position:relative;}
.tela-gestao-trafego :deep(.gt-set-pane)::before{content:'';position:absolute;left:12px;top:0;bottom:18px;border-left:2px solid var(--accent);opacity:.28;pointer-events:none;}
.tela-gestao-trafego :deep(.gt-ad-card::before){content:'';position:absolute;left:-8px;top:-9px;width:9px;height:24px;border-left:2px solid var(--accent);border-bottom:2px solid var(--accent);border-bottom-left-radius:9px;opacity:.55;pointer-events:none;}
.tela-gestao-trafego :deep(.gt-ad-top){display:flex;align-items:center;gap:8px;}
/* Status badge — replaces dot */
.tela-gestao-trafego :deep(.gt-status-badge){display:inline-flex;align-items:center;gap:4px;font-family:var(--fonte-principal);font-size:calc(9px*var(--gt-fs,1.3));font-weight:700;letter-spacing:.4px;padding:2px 8px;border-radius:20px;flex-shrink:0;text-transform:uppercase;}
.tela-gestao-trafego :deep(.gt-status-badge.active){background:rgba(22,163,74,.12);color:#16a34a;}
.tela-gestao-trafego :deep(.gt-status-badge.active::before){content:'';display:inline-block;width:5px;height:5px;border-radius:50%;background:#16a34a;animation:pulse 2s infinite;flex-shrink:0;}
.tela-gestao-trafego :deep(.gt-status-badge.paused){background:rgba(245,158,11,.12);color:#d97706;}
.tela-gestao-trafego :deep(.gt-status-badge.paused::before){content:'';display:inline-block;width:5px;height:5px;border-radius:50%;background:#f59e0b;flex-shrink:0;}
.tela-gestao-trafego :deep(.gt-status-badge.inactive){background:rgba(107,114,128,.1);color:#6b7280;}
.tela-gestao-trafego :deep(.gt-status-badge.inactive::before){content:'';display:inline-block;width:5px;height:5px;border-radius:50%;background:#9ca3af;flex-shrink:0;}
.tela-gestao-trafego :deep(.gt-chevron){flex-shrink:0;transition:transform .2s;color:var(--muted);opacity:.55;}
.tela-gestao-trafego :deep(.gt-chevron.open){transform:rotate(90deg);}
.tela-gestao-trafego :deep(.gt-expand-hint){font-family:var(--fonte-principal);font-size:calc(9px*var(--gt-fs,1.3));color:var(--muted);opacity:.7;white-space:nowrap;flex-shrink:0;transition:opacity .12s;}
.tela-gestao-trafego :deep(.gt-camp-top:hover .gt-expand-hint){opacity:1;color:var(--accent);}
.tela-gestao-trafego :deep(.gt-name){flex:1;min-width:0;font-family:var(--fonte-principal);font-size:calc(12px*var(--gt-fs,1.3));font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;transition:color .12s;}
.tela-gestao-trafego :deep(.gt-metrics){display:flex;align-items:center;gap:14px;flex-wrap:wrap;flex-shrink:0;}
.tela-gestao-trafego :deep(.gt-metric){font-family:var(--fonte-principal);font-size:calc(10px*var(--gt-fs,1.3));color:var(--muted);white-space:nowrap;}
.tela-gestao-trafego :deep(.gt-metric span){font-weight:700;color:var(--text);}
.tela-gestao-trafego :deep(.gt-kpi){font-family:var(--fonte-principal);font-size:calc(10px*var(--gt-fs,1.3));color:var(--muted);white-space:nowrap;display:inline-flex;align-items:center;gap:3px;}
.tela-gestao-trafego :deep(.gt-kpi-lbl){color:var(--muted);}
.tela-gestao-trafego :deep(.gt-kpi-val){font-weight:700;color:var(--text);}
.tela-gestao-trafego :deep(.gt-spend){font-family:var(--fonte-dados);font-size:calc(16px*var(--gt-fs,1.3));font-weight:700;color:var(--text);flex-shrink:0;min-width:65px;text-align:right;}
/* Action buttons */
.tela-gestao-trafego :deep(.gt-action-row){display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:4px;}
.tela-gestao-trafego :deep(.gt-act-btn){padding:4px 11px;border-radius:20px;font-family:var(--fonte-principal);font-size:calc(10px*var(--gt-fs,1.3));font-weight:600;cursor:pointer;transition:all .15s;border:1px solid var(--border);background:none;color:var(--text);white-space:nowrap;display:flex;align-items:center;gap:4px;}
.tela-gestao-trafego :deep(.gt-act-btn:hover){border-color:var(--accent);color:var(--accent);background:var(--accent-light);}
.tela-gestao-trafego :deep(.gt-act-btn.danger){border-color:rgba(220,38,38,.3);color:#dc2626;}
.tela-gestao-trafego :deep(.gt-act-btn.danger:hover){background:rgba(220,38,38,.08);border-color:#dc2626;}
.tela-gestao-trafego :deep(.gt-act-btn.success){border-color:rgba(22,163,74,.3);color:#16a34a;}
.tela-gestao-trafego :deep(.gt-act-btn.success:hover){background:rgba(22,163,74,.08);border-color:#16a34a;}
.tela-gestao-trafego :deep(.gt-act-btn.primary){border-color:var(--accent);color:var(--accent);}
.tela-gestao-trafego :deep(.gt-act-btn.primary:hover){background:var(--accent);color:#fff;}
.tela-gestao-trafego :deep(.gt-act-btn:disabled){opacity:.5;cursor:not-allowed;pointer-events:none;}
/* ===== Redesign direção A ===== */
/* Faixa de recomendação (estrela do cartão) */
.tela-gestao-trafego :deep(.gt-rec-banner){display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:11px 14px;margin:2px 0 10px;border-radius:10px;border-left:5px solid var(--border);background:var(--surface2);}
.tela-gestao-trafego :deep(.gt-rec-banner.positivo){border-left-color:var(--green);background:color-mix(in srgb,var(--green) 9%,transparent);}
.tela-gestao-trafego :deep(.gt-rec-banner.reduzir){border-left-color:var(--orange);background:color-mix(in srgb,var(--orange) 9%,transparent);}
.tela-gestao-trafego :deep(.gt-rec-banner.pausar){border-left-color:var(--red);background:color-mix(in srgb,var(--red) 9%,transparent);}
.tela-gestao-trafego :deep(.gt-rec-banner.neutral){border-left-color:var(--border);background:var(--surface2);}
.tela-gestao-trafego :deep(.gt-rec-main){flex:1;min-width:200px;}
.tela-gestao-trafego :deep(.gt-rec-head){display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.tela-gestao-trafego :deep(.gt-rec-verdict){font-family:var(--fonte-principal);font-weight:600;font-size:calc(17px*var(--gt-fs,1.3));text-transform:uppercase;letter-spacing:.02em;line-height:1;}
.tela-gestao-trafego :deep(.gt-rec-banner.positivo .gt-rec-verdict){color:var(--green);}
.tela-gestao-trafego :deep(.gt-rec-banner.reduzir .gt-rec-verdict){color:var(--orange);}
.tela-gestao-trafego :deep(.gt-rec-banner.pausar .gt-rec-verdict){color:var(--red);}
.tela-gestao-trafego :deep(.gt-rec-banner.neutral .gt-rec-verdict){color:var(--muted);font-size:calc(14px*var(--gt-fs,1.3));}
.tela-gestao-trafego :deep(.gt-rec-tag){font-family:var(--fonte-principal);font-size:calc(9px*var(--gt-fs,1.3));font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:var(--muted);}
.tela-gestao-trafego :deep(.gt-rec-just){font-family:var(--fonte-principal);font-size:calc(12px*var(--gt-fs,1.3));color:var(--text);margin-top:3px;line-height:1.4;}
.tela-gestao-trafego :deep(.gt-rec-banner.neutral .gt-rec-just){color:var(--muted);}
.tela-gestao-trafego :deep(.gt-rec-impact){font-family:var(--fonte-principal);font-size:calc(10px*var(--gt-fs,1.3));color:var(--muted);margin-top:2px;}
.tela-gestao-trafego :deep(.gt-rec-action){display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex-shrink:0;}
.tela-gestao-trafego :deep(.gt-rec-from){font-family:var(--fonte-principal);font-size:calc(11px*var(--gt-fs,1.3));color:var(--muted);text-decoration:line-through;}
.tela-gestao-trafego :deep(.gt-rec-arrow){color:var(--muted);}
.tela-gestao-trafego :deep(.gt-rec-to){font-family:var(--fonte-dados);font-size:calc(22px*var(--gt-fs,1.3));font-weight:600;color:var(--green);line-height:1;}
.tela-gestao-trafego :deep(.gt-rec-to small){font-family:var(--fonte-principal);font-size:calc(11px*var(--gt-fs,1.3));font-weight:500;color:var(--muted);}
.tela-gestao-trafego :deep(.gt-rec-banner.reduzir .gt-rec-to){color:var(--orange);}
.tela-gestao-trafego :deep(.gt-rec-keep){font-family:var(--fonte-principal);font-size:calc(12px*var(--gt-fs,1.3));font-weight:600;color:var(--green);}
/* Edição manual de orçamento (sempre disponível) */
.tela-gestao-trafego :deep(.gt-budget-edit){display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px;font-family:var(--fonte-principal);font-size:calc(11px*var(--gt-fs,1.3));color:var(--muted);}
.tela-gestao-trafego :deep(.gt-be-cur b){color:var(--text);font-weight:700;}
.tela-gestao-trafego :deep(.gt-be-link){background:none;border:none;color:var(--accent);font-size:calc(11px*var(--gt-fs,1.3));font-weight:600;cursor:pointer;padding:2px 4px;}
.tela-gestao-trafego :deep(.gt-be-link:hover){text-decoration:underline;}
.tela-gestao-trafego :deep(.gt-be-box){display:inline-flex;align-items:center;gap:6px;}
.tela-gestao-trafego :deep(.gt-be-box[hidden]){display:none;}
.tela-gestao-trafego :deep(.gt-be-box input){width:82px;padding:5px 7px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-family:var(--fonte-principal);font-size:calc(11px*var(--gt-fs,1.3));}
/* Pílula de veredito do anúncio + nome/porquê */
.tela-gestao-trafego :deep(.gt-ad-pill){font-family:var(--fonte-principal);font-size:calc(9px*var(--gt-fs,1.3));font-weight:800;text-transform:uppercase;letter-spacing:.04em;padding:3px 9px;border-radius:999px;flex-shrink:0;}
.tela-gestao-trafego :deep(.gt-ad-pill.manter){background:color-mix(in srgb,var(--green) 14%,transparent);color:var(--green);}
.tela-gestao-trafego :deep(.gt-ad-pill.pausar){background:color-mix(in srgb,var(--red) 14%,transparent);color:var(--red);}
.tela-gestao-trafego :deep(.gt-ad-name){flex:1;min-width:0;}
.tela-gestao-trafego :deep(.gt-ad-nm){font-family:var(--fonte-principal);font-size:calc(11px*var(--gt-fs,1.3));font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.tela-gestao-trafego :deep(.gt-ad-sub){font-family:var(--fonte-principal);font-size:calc(10px*var(--gt-fs,1.3));color:var(--muted);}
.tela-gestao-trafego :deep(.gt-ad-why){font-family:var(--fonte-principal);font-size:calc(10.5px*var(--gt-fs,1.3));color:var(--muted);line-height:1.4;padding-left:2px;}
/* Auto button */
.tela-gestao-trafego :deep(.gt-auto-btn){display:flex;align-items:center;gap:6px;padding:5px 14px;border-radius:7px;font-family:var(--fonte-principal);font-size:calc(11px*var(--gt-fs,1.3));font-weight:700;cursor:pointer;border:1px solid var(--border);background:none;color:var(--muted);letter-spacing:.3px;transition:all .2s;white-space:nowrap;position:relative;}
.tela-gestao-trafego :deep(.gt-auto-btn:hover){border-color:#9ca3af;color:var(--text);}
.tela-gestao-trafego :deep(.gt-auto-btn.active){border-color:#7c3aed;background:rgba(124,58,237,.12);color:#7c3aed;}
.tela-gestao-trafego :deep(.gt-auto-btn.active:hover){background:rgba(124,58,237,.2);}
.tela-gestao-trafego :deep(.gt-auto-btn.running){border-color:#7c3aed;background:#7c3aed;color:#fff;animation:pulse 1.5s infinite;}
.tela-gestao-trafego :deep(.gt-auto-btn:disabled){opacity:.5;cursor:not-allowed;}
.tela-gestao-trafego :deep(.gt-empty){text-align:center;padding:32px 16px;font-family:var(--fonte-principal);font-size:calc(12px*var(--gt-fs,1.3));color:var(--muted);line-height:1.7;}
/* Config modal (editor admin — métricas por objetivo) */
.tela-gestao-trafego :deep(#gt-cfg-btn){margin-right:4px;}
.tela-gestao-trafego :deep(#gt-cfg-overlay){position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1300;display:none;backdrop-filter:blur(2px);}
.tela-gestao-trafego :deep(#gt-cfg-modal){position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:1301;background:var(--surface);border:1px solid var(--border);border-radius:12px;width:min(720px,94vw);max-height:84vh;display:none;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.35);}
.tela-gestao-trafego :deep(.gt-cfg-head){padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;}
.tela-gestao-trafego :deep(.gt-cfg-title){font-family:var(--fonte-principal);font-size:calc(13px*var(--gt-fs,1.3));font-weight:700;color:var(--text);}
.tela-gestao-trafego :deep(.gt-cfg-close){background:none;border:none;color:var(--muted);cursor:pointer;font-size:calc(16px*var(--gt-fs,1.3));padding:0;line-height:1;}
.tela-gestao-trafego :deep(.gt-cfg-body){padding:16px 20px;overflow-y:auto;flex:1;}
.tela-gestao-trafego :deep(.gt-cfg-sec){margin-bottom:18px;}
.tela-gestao-trafego :deep(.gt-cfg-sec:last-child){margin-bottom:0;}
.tela-gestao-trafego :deep(.gt-cfg-obj){font-family:var(--fonte-principal);font-size:calc(11px*var(--gt-fs,1.3));font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--accent);margin-bottom:8px;}
.tela-gestao-trafego :deep(.gt-cfg-grid){display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:6px 10px;}
.tela-gestao-trafego :deep(.gt-cfg-chk){display:flex;align-items:center;gap:6px;font-family:var(--fonte-principal);font-size:calc(12px*var(--gt-fs,1.3));color:var(--text);cursor:pointer;user-select:none;}
.tela-gestao-trafego :deep(.gt-cfg-chk input){accent-color:var(--accent);cursor:pointer;}
.tela-gestao-trafego :deep(.gt-cfg-footer){padding:14px 20px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:flex-end;gap:10px;}
/* Modal "Ver criativo" */
.tela-gestao-trafego :deep(#gt-cr-overlay){position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1400;display:none;backdrop-filter:blur(2px);}
.tela-gestao-trafego :deep(#gt-cr-modal){position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:1401;background:var(--surface);border:1px solid var(--border);border-radius:12px;width:min(420px,94vw);max-height:88vh;display:none;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.4);overflow:hidden;}
.tela-gestao-trafego :deep(.gt-cr-body){padding:14px;overflow:auto;flex:1;display:flex;justify-content:center;align-items:flex-start;}
.tela-gestao-trafego :deep(.gt-cr-frame){width:100%;display:flex;justify-content:center;}
.tela-gestao-trafego :deep(.gt-cr-frame iframe){max-width:100%;border:none;border-radius:8px;}
@media(max-width:600px){.tela-gestao-trafego :deep(.gt-cfg-grid){grid-template-columns:repeat(auto-fill,minmax(140px,1fr));}}
@media(max-width:768px){
  .tela-gestao-trafego :deep(.gt-body){padding:12px 14px;}
  .tela-gestao-trafego :deep(.gt-camp-inner){padding:11px 14px 9px;}
  .tela-gestao-trafego :deep(.gt-camp-row-ads){padding-left:14px;padding-right:14px;}
}

/* ── Zoom de fonte (controle flutuante A−/A+ que _gtFontScale cria — legacy
   L1703-1707 + variante dark L1378-1381; cada tela que usa zoom traz sua
   própria cópia, mesmo padrão de tela-de-noticias.vue) ── */
.tela-gestao-trafego :deep(.zoomctl){position:fixed;right:20px;bottom:70px;z-index:9997;display:inline-flex;align-items:center;gap:2px;background:#ffffff;border:1px solid rgba(13,13,13,.14);border-radius:999px;box-shadow:0 8px 24px rgba(0,0,0,.18);padding:4px;}
.tela-gestao-trafego :deep(.zoomctl button){width:34px;height:34px;border:none;background:none;border-radius:50%;font-family:var(--fonte-principal);font-size:14px;font-weight:700;color:#1a1a1a;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s;}
.tela-gestao-trafego :deep(.zoomctl button:hover){background:#f0ece4;}
.tela-gestao-trafego :deep(.zoomctl-val){font-family:var(--fonte-principal);font-size:11px;font-weight:600;color:#6b6258;min-width:40px;text-align:center;cursor:pointer;user-select:none;font-variant-numeric:tabular-nums;}
@media(max-width:560px){.tela-gestao-trafego :deep(.zoomctl){right:14px;bottom:64px;}}
[data-theme="dark"] .tela-gestao-trafego :deep(.zoomctl){background:#211d16;border-color:rgba(255,255,255,.2);}
[data-theme="dark"] .tela-gestao-trafego :deep(.zoomctl button){color:#ece7dc;}
[data-theme="dark"] .tela-gestao-trafego :deep(.zoomctl button:hover){background:#2c2719;}
[data-theme="dark"] .tela-gestao-trafego :deep(.zoomctl-val){color:#9a9285;}

/* ── RESPONSIVE: topbar/clock (compartilhado com Gestão à Vista/Análise de
     Campanhas — cada tela traz sua cópia; ver legacy L645-662 e L694-696) ── */
@media(max-width:1024px){
  .tela-gestao-trafego :deep(.gv-topbar){flex-wrap:wrap;padding:8px 14px;gap:6px;}
  .tela-gestao-trafego :deep(.gv-clock-wrap){display:none;}
}
@media(max-width:640px){
  .tela-gestao-trafego{--gt-fs:1 !important;}   /* celular: fonte 100%. !important p/ vencer o inline que _gtFontScale grava. */
  /* Topbar do celular: LINHA 1 = marca (esquerda) + KPIs + conta (direita); LINHA 2 = filtros que rolam. */
  .tela-gestao-trafego :deep(.gv-topbar){flex-wrap:wrap;align-items:center;padding:8px 12px;gap:8px;}
  .tela-gestao-trafego :deep(.gv-topbar-brand){order:0;flex:1 1 auto;min-width:0;gap:8px;}
  .tela-gestao-trafego :deep(.gv-brand-tag){display:none;}
  .tela-gestao-trafego :deep(.gt-auto-btn){order:1;flex-shrink:0;}
  .tela-gestao-trafego :deep(#gt-account-picker){order:2;flex-shrink:0;}
  /* filtros de período: faixa própria (linha 2) que ROLA na horizontal — nunca quebram em 3 linhas */
  .tela-gestao-trafego :deep(.gv-period-btns){order:3;width:100%;flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;gap:6px;padding-bottom:2px;}
  .tela-gestao-trafego :deep(.gv-pbtn){font-size:10px;padding:5px 10px;border-radius:6px;flex-shrink:0;white-space:nowrap;}
  .tela-gestao-trafego :deep(.gv-clock-wrap),.tela-gestao-trafego :deep(.gv-update-status){display:none;}
  /* CORPO DOS CARDS no celular: botões QUEBRAM o texto (não estouram) + busca ocupa a largura */
  .tela-gestao-trafego :deep(.gt-act-btn){white-space:normal;max-width:100%;height:auto;text-align:center;}
  .tela-gestao-trafego :deep(.gt-camp-hdr input){width:100% !important;flex:1 1 100%;box-sizing:border-box;}
  .tela-gestao-trafego :deep(.gt-rec-banner){align-items:flex-start;}
  .tela-gestao-trafego :deep(.gt-rec-banner .gt-act-btn){width:100%;justify-content:center;}
  .tela-gestao-trafego :deep(.gt-action-row){width:100%;}
  .tela-gestao-trafego :deep(.gt-action-row .gt-act-btn){flex:1 1 auto;}
  /* nada dentro do card pode empurrar a largura pra fora */
  .tela-gestao-trafego :deep(.gt-camp-inner),.tela-gestao-trafego :deep(.gt-camp-row){max-width:100%;overflow-x:clip;}
  /* Conjuntos no celular: cabeçalho quebra em 2 linhas em vez de estourar a tela */
  .tela-gestao-trafego :deep(.gt-camp-row-ads){padding:0 10px 12px 10px;}
  .tela-gestao-trafego :deep(.gt-set-card){margin-left:0;max-width:100%;overflow-x:clip;}
  .tela-gestao-trafego :deep(.gt-set-top){flex-wrap:wrap;gap:6px;}
  .tela-gestao-trafego :deep(.gt-set-nm){flex:1 1 100%;order:3;white-space:normal;}
  .tela-gestao-trafego :deep(.gt-set-exp){order:4;margin-left:auto;}
  .tela-gestao-trafego :deep(.gt-ad-card){margin-left:10px;}
  /* No estreito a árvore não cabe: some com as DUAS peças da guia (o L do anúncio
     e o trilho do conjunto). Esconder só uma deixaria a linha vertical solta. */
  .tela-gestao-trafego :deep(.gt-ad-card::before){display:none;}
  .tela-gestao-trafego :deep(.gt-set-pane)::before{display:none;}
  .tela-gestao-trafego :deep(.gt-collapse-all){flex:1 1 auto;}
  .tela-gestao-trafego :deep(.gt-be-box){flex:1 1 100%;}
  .tela-gestao-trafego :deep(.gt-be-box input){flex:1 1 auto;width:auto;min-width:0;}
}
@media(max-width:480px){
  /* SEM inverter a ordem da marca (o order:1 antigo jogava a marca pro fim = bug) */
  .tela-gestao-trafego :deep(.gv-topbar){padding:8px 12px;gap:8px;}
  .tela-gestao-trafego :deep(.gv-topbar-brand){gap:8px;}
}
</style>
