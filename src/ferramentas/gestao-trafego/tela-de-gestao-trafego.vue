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

    <!-- Casca de abas: só mostra/esconde painel via _gtTrocarAba, nunca
         remonta a lista de campanhas (remontar chamaria a Meta de novo). -->
    <div class="pnd-abas" role="tablist">
      <button class="pnd-aba ativa" id="pnd-aba-campanhas" role="tab" onclick="_gtTrocarAba('campanhas')">Campanhas</button>
      <button class="pnd-aba" id="pnd-aba-regua" role="tab" onclick="_gtTrocarAba('regua')">A régua</button>
    </div>

    <!-- #gt-painel-campanhas é "display:contents" (ver <style> abaixo): ele só
         existe pra o toggle de aba (_gtTrocarAba liga/desliga com style.display),
         mas NÃO pode virar uma caixa de verdade no layout — .gt-body é quem é o
         item flex real (flex:1 + overflow-y:auto) dentro de .tela-gestao-trafego.
         Um <div> comum aqui quebraria essa conta (flex:1 de .gt-body deixaria de
         valer, e a lista de campanhas perderia o scroll contido). -->
    <div id="gt-painel-campanhas">
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

    <div id="gt-painel-regua" style="display:none"></div>
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
// Aba "A régua" (métrica ponderada): painel puro + os módulos que leem/normalizam
// a régua vinda do banco (ver painel-regua.js, ponderada.js, regua.js).
import { montarPainelRegua } from './painel-regua.js'
import { normalizarRegua, metaDoBalde } from './regua.js'
import { quantidadesDoInsight, calcularPonderada } from './ponderada.js'
import { decidirVeredito } from './veredito.js'
// Alvo de cada tipo de campanha (custo por lead/conversa/venda/visita/mil
// pessoas, ou por ponto no caso de engajamento) — ver alvos.js.
import { alvoDoBalde, avaliarAlvo } from './alvos.js'
// Fase 3 — objetivo por interação: o dono DECLARA, campanha a campanha (ou
// anúncio a anúncio) de engajamento, qual interação aquilo está comprando
// (curtida/comentário/salvamento/compartilhamento). Sem declarar, nada muda —
// continua no ponto ponderado, exatamente como hoje. Ver interacoes.js.
import { INTERACOES, custoDaInteracao, interacaoValida } from './interacoes.js'

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
let _gtAbaAtiva='campanhas';
// Seleção múltipla para PAUSAR EM MASSA. Mora FORA do render de propósito: a
// lista é redesenhada a cada busca/filtro/recolher, e uma seleção guardada
// dentro do render sumiria sozinha no meio do trabalho.
// Chave 'campaign:<id>' | 'ad:<id>' -> { kind, id, nome }.
// Só entra aqui o que está ATIVO: a ação em massa só FREIA (decisão do dono,
// 2026-07-27) — reativar continua sendo um a um, com confirmação individual.
let _gtSelecao=new Map();
// Objetivo por interação (Fase 3): mapa alvo_id (campanha OU anúncio) ->
// interação declarada ('curtidas'|'comentarios'|'salvamentos'|'compartilhamentos').
// Sem entrada = não declarou = continua no ponto ponderado. Carregado uma vez
// por loadGtData() (ver _gtCarregarObjetivos), igual à régua e ao Opus IA.
let _gtObjetivoInteracao={};
// Fail-CLOSED (M3 do review, 2026-07-28), mesmo padrão de _gtReguaCarregada:
// só fica true depois de uma leitura que REALMENTE deu certo. Enquanto for
// false, um alvo AUSENTE do mapa não pode virar "Objetivo: ponderado" com
// confiança — pode ser que exista uma declaração real no banco que esta
// leitura, ao falhar, não trouxe. Ver _gtCarregarObjetivos e _gtSeloObjetivoEl.
let _gtObjetivoInteracaoCarregada=false;

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
    // Pré-pago: mostra o saldo (verde=folgado, âmbar=apertando, vermelho=baixo). Sem pré-pago
    // (cartão): mostra a nota, não um número.
    const balTxt=bal!=null?_maFmtR(bal):(a.notaSaldo||'—');
    const balColor=bal==null?'var(--muted)':bal>=1000?'#16a34a':bal>=500?'#f59e0b':'#dc2626';
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
          metaFetch(`/act_${a.ad_account_id}`,{fields:'name,currency,funding_source_details{type,display_string}'},a.id),
          metaFetch(`/act_${a.ad_account_id}/insights`,{fields:'spend',date_preset:'this_month'},a.id).catch(()=>null),
        ]);
        if(d?.name)a.display_name=d.name;
        // SALDO = quanto de dinheiro a conta ainda TEM pra gastar. O número real vem do
        // "Saldo disponível" do meio de pagamento (funding_source_details.display_string),
        // ex.: "Saldo disponível (R$6.345,70 BRL)". NÃO é o campo `balance` (esse é gasto não
        // faturado, dava R$550 enganoso) nem limite−gasto (dava aproximado errado).
        // Só contas PRÉ-PAGAS têm saldo. Cartão de crédito (pós-pago) não tem — mostra a forma
        // de pagamento em vez de um número.
        const fsd=d?.funding_source_details||{};
        const ds=fsd.display_string||'';
        const m=ds.match(/R\$\s*([\d.]+,\d{2})/); // formato BR: 6.345,70
        if(m){ a.balance=parseFloat(m[1].replace(/\./g,'').replace(',','.')); a.notaSaldo=null; }
        else { a.balance=null; a.notaSaldo=ds?('via '+ds):'sem saldo pré-pago'; } // cartão/sem pré-pago
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
// Mensagens (WhatsApp/Direct): action_types REAIS conferidos na API (La Vessel I, 2026-07).
// "Conversas iniciadas" é o messaging_conversation_started_7d — o resultado principal das
// campanhas de mensagem (WhatsApp). Os outros são etapas mais fundas da conversa.
const _GT_MSG=['onsite_conversion.messaging_conversation_started_7d','onsite_conversion.messaging_conversation_started'];
const _GT_MSG_CONN=['onsite_conversion.total_messaging_connection'];
const _GT_MSG_REPLY=['onsite_conversion.messaging_first_reply'];
const _GT_ATC=['add_to_cart','omni_add_to_cart','offsite_conversion.fb_pixel_add_to_cart'];
const _GT_IC=['initiate_checkout','omni_initiated_checkout','offsite_conversion.fb_pixel_initiate_checkout'];
const _GT_VIDEO=['video_view'];
const _GT_POSTENG=['post_engagement'];
const _GT_LPV=['landing_page_view'];
const _gtPerGasto=(r,tipos)=>{ const n=_gtActionVal(r,tipos),s=_gtNum(r.spend); return n?s/n:null; };
const GT_METRIC_CATALOG={
  alcance:{label:'Alcance',fmt:'int',compute:r=>_gtNum(r.reach)},
  impressoes:{label:'Impressões',fmt:'int',compute:r=>_gtNum(r.impressions)},
  frequencia:{label:'Frequência',fmt:'dec',compute:r=>_gtNum(r.frequency)},
  ctr:{label:'CTR',fmt:'pct',compute:r=>_gtNum(r.ctr)},
  cpc:{label:'CPC',fmt:'money',compute:r=>_gtNum(r.cpc)},
  cpm:{label:'CPM',fmt:'money',compute:r=>{const i=_gtNum(r.impressions),s=_gtNum(r.spend);return i?s/i*1000:null;}},
  cliques:{label:'Cliques',fmt:'int',compute:r=>_gtNum(r.clicks)},
  visitas:{label:'Visitas',fmt:'int',compute:r=>_gtActionVal(r,_GT_VISIT)},
  custo_visita:{label:'Custo/Visita',fmt:'money',compute:r=>_gtPerGasto(r,_GT_VISIT)},
  lpv:{label:'Visualizações da página',fmt:'int',compute:r=>_gtActionVal(r,_GT_LPV)},
  compras:{label:'Compras',fmt:'int',compute:r=>_gtActionVal(r,_GT_PURCHASE)},
  valor_conversao:{label:'Valor de conversão',fmt:'money',compute:r=>_gtActionValue(r,_GT_PURCHASE)},
  roas:{label:'ROAS',fmt:'x',compute:r=>{const pr=r.purchase_roas&&r.purchase_roas[0]&&_gtNum(r.purchase_roas[0].value);if(pr!=null)return pr;const v=_gtActionValue(r,_GT_PURCHASE),s=_gtNum(r.spend);return (v!=null&&s)?v/s:null;}},
  cac:{label:'CAC',fmt:'money',compute:r=>{const c=_gtActionVal(r,_GT_PURCHASE),s=_gtNum(r.spend);return c?s/c:null;}},
  add_carrinho:{label:'Add. ao carrinho',fmt:'int',compute:r=>_gtActionVal(r,_GT_ATC)},
  checkout:{label:'Checkout iniciado',fmt:'int',compute:r=>_gtActionVal(r,_GT_IC)},
  gasto:{label:'Gasto',fmt:'money',compute:r=>_gtNum(r.spend)},
  leads:{label:'Leads',fmt:'int',compute:r=>_gtActionVal(r,_GT_LEAD)},
  custo_lead:{label:'Custo/Lead',fmt:'money',compute:r=>{const l=_gtActionVal(r,_GT_LEAD),s=_gtNum(r.spend);return l?s/l:null;}},
  // --- Mensagens (WhatsApp/Direct) ---
  conversas:{label:'Conversas iniciadas',fmt:'int',compute:r=>_gtActionVal(r,_GT_MSG)},
  custo_conversa:{label:'Custo/Conversa',fmt:'money',compute:r=>_gtPerGasto(r,_GT_MSG)},
  conexoes_msg:{label:'Conexões de mensagem',fmt:'int',compute:r=>_gtActionVal(r,_GT_MSG_CONN)},
  primeira_resposta:{label:'1ª resposta',fmt:'int',compute:r=>_gtActionVal(r,_GT_MSG_REPLY)},
  // --- Vídeo e engajamento ---
  video_views:{label:'Views de vídeo',fmt:'int',compute:r=>_gtActionVal(r,_GT_VIDEO)},
  engaj_pub:{label:'Engajamento da publicação',fmt:'int',compute:r=>_gtActionVal(r,_GT_POSTENG)},
};
const GT_OBJETIVO_BALDE={
  OUTCOME_TRAFFIC:'trafego', LINK_CLICKS:'trafego',
  OUTCOME_SALES:'vendas', CONVERSIONS:'vendas', PRODUCT_CATALOG_SALES:'vendas',
  OUTCOME_AWARENESS:'reconhecimento', BRAND_AWARENESS:'reconhecimento', REACH:'reconhecimento', VIDEO_VIEWS:'reconhecimento',
  // Engajamento inclui as campanhas de MENSAGEM modernas (OUTCOME_ENGAGEMENT com destino WhatsApp),
  // por isso o balde de engajamento passou a ter Conversas iniciadas. MESSAGES (objetivo antigo
  // de mensagem) tem balde próprio 'mensagens'.
  OUTCOME_ENGAGEMENT:'engajamento', POST_ENGAGEMENT:'engajamento', PAGE_LIKES:'engajamento',
  MESSAGES:'mensagens',
  OUTCOME_LEADS:'leads', LEAD_GENERATION:'leads',
};
const GT_BALDE_PADRAO={
  // custo_visita é a métrica que DECIDE o veredito deste balde (ver alvos.js
  // ALVOS.trafego) — precisa aparecer no cartão, senão o dono vê o selo mudar
  // sem enxergar o número que o explica (I6 do review final, 2026-07-28).
  trafego:['ctr','cpc','visitas','custo_visita','cpm'],
  vendas:['roas','cac','valor_conversao','compras'],
  reconhecimento:['alcance','cpm','frequencia','impressoes'],
  // Conversas iniciadas primeiro: é o resultado principal das campanhas de WhatsApp (La Vessel I).
  // Em campanha de engajamento sem mensagem, "conversas" aparece como "—" (sem ação de mensagem).
  engajamento:['conversas','custo_conversa','ctr','gasto'],
  mensagens:['conversas','custo_conversa','conexoes_msg','gasto'],
  leads:['leads','custo_lead','ctr','gasto'],
  padrao:['ctr','cpc','gasto','alcance'],
};
function _gtBalde(objective){ return GT_OBJETIVO_BALDE[String(objective||'').toUpperCase()]||'padrao'; }
// Fragmento "por X" pra frase do veredito (ver veredito.js porqueDaPonderada).
// Vem do MESMO rótulo que a régua já mostra (ALVOS[balde].rotulo, ex.: "Custo
// por conversa iniciada"), só sem o prefixo "Custo " — evita duplicar a unidade
// de cada objetivo em dois lugares (I3 do review final, 2026-07-28).
function _gtRotuloPorUnidade(alvoObj){
  if(!alvoObj || !alvoObj.rotulo) return 'por ponto';
  return alvoObj.rotulo.replace(/^Custo\s+/i, '');
}
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
// Declarações de objetivo por interação (Fase 3). sb() NUNCA lança — devolve
// [] com .erro em qualquer falha (rede, sessão, RLS); aqui basta checar
// linhas.erro antes de usar (mesmo padrão de _gtCarregarRegua/_gtLoadConfig).
async function _gtCarregarObjetivos(){
  const linhas=await sb('gt_objetivo_interacao?select=alvo_id,interacao');
  const ok=!linhas.erro;
  if(ok){
    _gtObjetivoInteracao={};
    for(const l of linhas) _gtObjetivoInteracao[String(l.alvo_id)]=l.interacao;
  }else{
    // NUNCA apagar o mapa em silêncio (M3 do review, 2026-07-28): se a leitura
    // falhar, o mapa anterior (as declarações que já sabíamos ser verdade)
    // fica exatamente como estava — é o que impede uma campanha DECLARADA de
    // voltar sozinha a ser julgada pelo ponto ponderado só porque um recarregar
    // deu erro de rede/sessão. O detalhe técnico vai pro console; o selo (ver
    // _gtSeloObjetivoEl) trata a incerteza pra quem só usa esta variável.
    console.error('[GT] falha ao carregar as declarações de objetivo por interação:', linhas.erro);
  }
  _gtObjetivoInteracaoCarregada=ok;
}
// Grava (ou apaga, se interacao=null/undefined) a declaração de UMA campanha ou
// UM anúncio. Escrita autenticada por sbClient (RLS: admin OU feature
// 'meta.gestor', igual à régua) — nunca por sb(), que é só leitura.
async function _gtSalvarObjetivo(alvoId,nivel,interacao){
  const resp=interacao
    ?await sbClient.from('gt_objetivo_interacao').upsert({
        alvo_id:String(alvoId),nivel,interacao,
        conta_id:_gtCurAcc?.id||null,updated_by:estado.userId||null,
        updated_at:new Date().toISOString(),
      },{onConflict:'alvo_id'}).select()
    :await sbClient.from('gt_objetivo_interacao').delete().eq('alvo_id',String(alvoId)).select();
  const{data,error}=resp;
  if(error){
    // H2(a) do review: mesmo com o selo gated por permissão, uma sessão que
    // perdeu o acesso NO MEIO do uso ainda pode tentar salvar — aí o Postgres
    // recusa por RLS, e o dono não pode ver o jargão técnico cru (42501/"row-
    // level security"). _gtEhErroDePermissao já existe pra isso (mesmo helper
    // usado por _gtSalvarRegua).
    adminToast(_gtEhErroDePermissao(error)
      ? 'Você não tem permissão para editar esta ferramenta, então não deu para declarar o objetivo.'
      : 'Não consegui salvar o objetivo: '+error.message, false);
    return;
  }
  // H2(b) do review: o PostgREST devolve 200/204 com ZERO linhas e SEM `error`
  // quando a RLS filtra a linha da resposta — pra ele é indistinguível de "deu
  // certo". Sem checar isto, um apagar ("Voltar ao ponderado") sem permissão
  // real parecia ter funcionado: a tela apagava a declaração local, não avisava
  // nada, e ela reaparecia sozinha no próximo loadGtData() (porque no banco
  // continuava lá). `.select()` acima é o que permite enxergar essa diferença.
  if(!data||!data.length){
    // B1 do review (2026-07-28): zero linhas SEM erro no APAGAR também acontece
    // quando a linha já não existia — o menu sempre oferece "Voltar ao
    // ponderado", inclusive pra um alvo sem declaração nenhuma, e apagar o que
    // não existe devolve zero linhas do mesmo jeito, sem erro nenhum. Como
    // gt_objetivo_interacao está vazia hoje, TODO clique em "Voltar ao
    // ponderado" caía aqui e mentia "sem permissão" pro dono — inclusive num
    // segundo clique logo depois de um reverter normal. Só o apagar é ambíguo
    // assim: um upsert bem-sucedido sempre devolve a linha, e uma negação de
    // upsert já caiu no `error` 42501 lá em cima — por isso só desambiguamos
    // quando `interacao` for o apagar (falsy).
    if(!interacao){
      const confirma=await sb(`gt_objetivo_interacao?select=alvo_id&alvo_id=eq.${String(alvoId)}`);
      if(confirma.erro){
        // sb() nunca lança — devolve [] com .erro em qualquer falha (rede,
        // sessão, 5xx). Sem saber se a linha ainda existe, o caminho cauteloso
        // é não afirmar nem sucesso nem "sem permissão": nenhum dos dois está
        // confirmado.
        adminToast('Não consegui confirmar se deu certo. Tente de novo em instantes.',false);
        return;
      }
      if(confirma.length){
        // a linha continua lá de verdade: aí sim foi negação de permissão.
        adminToast('Você não tem permissão para editar esta ferramenta, então não deu para salvar o objetivo.',false);
        return;
      }
      // a linha já não existia antes do clique: não era negação, era não ter
      // nada pra desfazer. Cai pro bloco de sucesso abaixo.
    } else {
      adminToast('Você não tem permissão para editar esta ferramenta, então não deu para salvar o objetivo.',false);
      return;
    }
  }
  // B2 do review: sem um aviso explícito, o re-render abaixo recolhe os painéis
  // expandidos e o clique fica sem NENHUM sinal de que algo aconteceu — o toast
  // (adminToast) é a confirmação visível de que o objetivo mudou de verdade.
  if(interacao){
    _gtObjetivoInteracao[String(alvoId)]=interacao;
    adminToast('Objetivo definido: '+(INTERACOES[interacao]?.rotulo||interacao)+'.');
  }else{
    delete _gtObjetivoInteracao[String(alvoId)];
    adminToast('Objetivo voltou a ser o ponto ponderado.');
  }
  // M6 do review: nada mudou do lado da Meta — a declaração é estado local
  // (banco próprio, gt_objetivo_interacao). Recarregar a conta inteira via
  // loadGtData() custaria 5 chamadas à Graph API por CLIQUE (e perderia
  // scroll/expansão), só pra redesenhar um selo. Redesenha com os dados que
  // já estão em memória.
  const col=document.getElementById('gt-camp-col');
  if(col)_renderGtCampaigns(col,_gtCampaigns,_gtInsights,_gtAdInsights,_gtAdsets);
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

// ── A régua (métrica ponderada): pesos, metas de custo por balde e limiares
// do veredito. Lida por qualquer usuário logado (RLS aberta pra leitura);
// escrita gated no banco a quem tem ACESSO À FERRAMENTA (admin OU a feature
// 'meta.gestor' — decisão do dono, 2026-07-28: editar a régua é uma ação da
// ferramenta, não um privilégio de admin) — a tela usa esse MESMO critério
// (hasPermission('meta.gestor', 'editar')) pra decidir se mostra os campos
// editáveis, senão o dono via campo editável que não consegue mesmo salvar
// (ver painel-regua.js e o call site em _gtTrocarAba).
let _gtRegua = normalizarRegua(null);   // começa no padrão; o banco sobrescreve
// Só fica true quando a leitura do banco realmente funcionou. Enquanto for false,
// a aba "A régua" NÃO pode deixar salvar: _gtRegua ainda é o padrão de fábrica
// (ou o valor de uma leitura anterior), nunca a meta real das cinco contas — e
// salvar isso sobrescreveria a linha única de verdade. Ver _gtTrocarAba e C3 do
// review final (2026-07-28).
let _gtReguaCarregada = false;

async function _gtCarregarRegua() {
  // sb() NUNCA lança — ver src/compartilhado/buscar-e-salvar-dados.js. Falha de
  // rede, sessão expirada (401), falta de GRANT (42501) e erro do servidor (5xx)
  // voltam como array vazio com .erro anexado (comErro); uma negação de RLS
  // devolve 200 com lista vazia, SEM .erro — pro PostgREST é indistinguível de
  // "a tabela realmente não tem nada". Um try/catch aqui era código morto: o
  // catch nunca rodava, e a flag de "carregou" ficava true mesmo numa leitura
  // que falhou silenciosamente. C3 do review final (2026-07-28).
  const linhas = await sb('gt_ponderada_config?select=pesos,metas,limiares&id=eq.1');
  const ok = !linhas.erro && linhas.length > 0;
  if (ok) {
    _gtRegua = normalizarRegua(linhas[0]);
  } else {
    // NUNCA engolir em silêncio: sem isso, a aba abre com o padrão de fábrica e
    // parece a régua real. O detalhe técnico vai pro console; o dono só precisa
    // saber, na tela, que o campo pode não estar confiável (ver montarPainelRegua).
    console.error('[GT] falha ao carregar a régua da métrica ponderada:', linhas.erro || 'a leitura voltou sem nenhuma linha');
    _gtRegua = normalizarRegua(null);
  }
  _gtReguaCarregada = ok;
  // Se a aba "A régua" já estiver aberta (ex.: o dono deixou a aba aberta e a
  // sessão renovou depois), remonta o painel com o resultado fresco. Sem isto,
  // uma leitura que só dá certo DEPOIS do primeiro paint deixaria o botão
  // "Salvar" preso em desabilitado até o dono trocar de aba e voltar.
  if (_gtAbaAtiva === 'regua') _gtTrocarAba('regua');
}

// Reconhece uma rejeição de permissão/RLS do Postgres (código 42501 ou texto
// "row-level security"/"permission denied") pra nunca mostrar esse jargão
// técnico pro dono — ele só precisa saber que faltou permissão de editar
// esta ferramenta.
function _gtEhErroDePermissao(e) {
  const codigo = e && e.code;
  const msg = String((e && e.message) || '').toLowerCase();
  return codigo === '42501' || msg.includes('row-level security') || msg.includes('permission denied');
}

async function _gtSalvarRegua(nova, botao) {
  const orig = botao ? botao.textContent : '';
  if (botao) { botao.disabled = true; botao.textContent = 'Salvando...'; }
  try {
    const antes = _gtRegua;
    // QUEM mexeu: estado.userId é o mesmo id já usado no resto da tela (ver
    // _setGubAvatar em tela-de-admin.vue) — sem isto, updated_by/mudou_quem
    // ficavam sempre nulos e o histórico não dizia quem alterou.
    const { error } = await sbClient.from('gt_ponderada_config')
      .update({ pesos: nova.pesos, metas: nova.metas, limiares: nova.limiares, updated_at: new Date().toISOString(), updated_by: estado.userId })
      .eq('id', 1);
    if (error) throw error;
    _gtRegua = nova;
    // histórico: guarda o antes e o depois inteiros. Uma falha AQUI não desfaz o
    // save (a régua já está salva) — mas o dono precisa saber que o histórico
    // dessa alteração não ficou registrado, senão a auditoria fica com buraco
    // em silêncio.
    const { error: erroHistorico } = await sbClient.from('gt_ponderada_config_log').insert({ antes, depois: nova, mudou_quem: estado.userId });
    if (erroHistorico) {
      console.error('[GT] falha ao gravar o histórico da régua:', erroHistorico);
      adminToast('Régua salva, mas não consegui gravar o histórico dessa alteração.', false);
    } else {
      adminToast('Régua salva');
    }
    await loadGtData();           // a lista inteira recalcula com os pesos novos (e a régua é relida do banco)
    // Remonta a aba com o estado fresco pós-salvar. Sem isto, limpar um campo e
    // salvar de novo cairia no valor de ANTES do primeiro save (o `regua` que o
    // painel guardava em memória), não no valor que está no banco agora.
    _gtTrocarAba('regua');
  } catch (e) {
    if (_gtEhErroDePermissao(e)) {
      adminToast('Você não tem permissão para editar esta ferramenta, então não deu para alterar a régua.', false);
    } else {
      console.error('[GT] erro ao salvar a régua:', e);
      adminToast('Não foi possível salvar a régua agora. Tente de novo.', false);
    }
  } finally {
    if (botao) { botao.disabled = false; botao.textContent = orig; }
  }
}

// Campanha de maior gasto na tela, usada como exemplo vivo da aba da régua.
// Precisa escolher o MESMO alvo que o cartão da campanha escolheria (ver bloco
// "ALVO DO OBJETIVO" acima) — inclusive o desvio de campanha-de-mensagem —
// senão o exemplo vivo ensina a conta errada pro dono (C1 do review final,
// 2026-07-28: nesta conta, a campanha de maior gasto é de WhatsApp).
// UM exemplo por OBJETIVO que a conta realmente roda — não só a campanha de maior
// gasto. O dono pediu isso depois de olhar a régua: ele precisa ver como cada tipo
// de campanha será julgado, não só o tipo da campanha mais cara. De cada balde vai
// a campanha de MAIOR GASTO, que é a mais representativa do dinheiro dele.
function _gtExemplosParaRegua() {
  const porBalde = {};
  const porInteracao = {};
  for (const linha of _gtInsights) {
    const baldeBruto = _gtBalde(linha.objective);
    // Mesma correção do cartão: campanha de WhatsApp chega como OUTCOME_ENGAGEMENT.
    const temMensagem = baldeBruto === 'engajamento' && (
      _gtActionVal(linha, _GT_MSG) != null
      || _gtActionVal(linha, _GT_MSG_CONN) != null
      || _gtActionVal(linha, _GT_MSG_REPLY) != null
    );
    const balde = temMensagem ? 'mensagens' : baldeBruto;
    if (alvoDoBalde(balde)) {
      const atual = porBalde[balde];
      if (!atual || Number(linha.spend || 0) > Number(atual.spend || 0)) porBalde[balde] = linha;
    }
    // Exemplo POR INTERAÇÃO: a régua tem meta por curtida/comentário/salvamento/
    // compartilhamento, então cada uma dessas metas também precisa do seu "como
    // fica na prática" — senão o dono digita um número sem ver o efeito.
    // Escolhe a campanha com MAIS daquela interação (a mais representativa dela),
    // e só entre campanhas de engajamento, que é onde a declaração vale.
    if (balde === 'engajamento') {
      const q = quantidadesDoInsight(linha);
      for (const chave of Object.keys(INTERACOES)) {
        if (!(q[chave] > 0)) continue;                       // zero não vira exemplo
        const atual = porInteracao[chave];
        if (!atual || q[chave] > atual.qtd) porInteracao[chave] = { linha, qtd: q[chave], q };
      }
    }
  }
  const exemplos = [];
  for (const [balde, linha] of Object.entries(porBalde)) {
    const alvo = alvoDoBalde(balde);
    exemplos.push({
      tipo: 'objetivo',
      chave: balde,
      rotulo: alvo.rotulo,
      nome: linha.campaign_name || 'sua campanha',
      balde,
      quantidades: quantidadesDoInsight(linha),
      // Custo pronto p/ todo balde que NÃO é a ponderada — o painel recalcula ao
      // vivo só o caso 'ponderada' (engajamento), a partir de `quantidades`.
      custo: alvo.metrica !== 'ponderada' ? _gtMetricValue(alvo.metrica, linha) : null,
      detalhe: alvo.resultado
        ? [{ rotulo: GT_METRIC_CATALOG[alvo.resultado]?.label || alvo.resultado,
             valor: _gtMetricValue(alvo.resultado, linha) }]
        : null,
    });
  }
  for (const [chave, { linha, qtd, q }] of Object.entries(porInteracao)) {
    exemplos.push({
      tipo: 'interacao',
      chave,
      rotulo: INTERACOES[chave].rotuloCusto,
      titulo: INTERACOES[chave].rotulo,
      nome: linha.campaign_name || 'sua campanha',
      balde: 'engajamento',
      quantidades: q,
      custo: custoDaInteracao(q, chave),
      detalhe: [{ rotulo: INTERACOES[chave].rotulo, valor: qtd }],
    });
  }
  // Ordem de leitura: primeiro os objetivos de resultado (onde há mais dinheiro),
  // depois as interações — é a mesma ordem dos cartões da régua ao lado.
  exemplos.sort((a, b) => {
    if (a.tipo !== b.tipo) return a.tipo === 'objetivo' ? -1 : 1;
    return Number(b.quantidades.gasto || 0) - Number(a.quantidades.gasto || 0);
  });
  return exemplos;
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
  // Zera a seleção de "pausar em massa" a cada recarga. É de segurança: recarregar
  // acontece ao TROCAR DE CONTA de anúncios, e uma seleção sobrevivente carregaria
  // ids da conta anterior pra dentro da conta nova. Não atrapalha o uso normal —
  // não existe recarga automática por tempo aqui (o timer só repinta o "atualizado
  // há X"), então a lista só se refaz quando o próprio usuário pede.
  _gtLimparSelecao();
  if(!_gtCurAcc){col.innerHTML='<div class="gt-camp-card"><div class="gt-empty">Nenhuma conta selecionada.</div></div>';return;}
  col.innerHTML='<div class="gv-loading-screen"><div class="gv-spinner"></div><span class="gv-loading-lbl">Carregando campanhas</span></div>';
  // Reset AI suggestions
  const sugs=document.getElementById('gt-suggestions');
  if(sugs)sugs.innerHTML='';
  try{
    if(!_gtConfigLoaded){ await _gtLoadConfig(); _gtConfigLoaded=true; }
    await _gtCarregarRegua();
    await _gtLoadBudgetIA();
    await _gtLoadAdIA();
    await _gtCarregarObjetivos();
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
    // A aba da régua vive de campanhas reais no exemplo. Sem isto, trocar de conta
    // de anúncios (ou abrir a régua antes de os dados chegarem) deixava o exemplo
    // velho ou vazio, e o dono precisava passar pela aba Campanhas primeiro.
    if(_gtAbaAtiva==='regua') _gtTrocarAba('regua');
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
// ── Pausar em massa ────────────────────────────────────────────────────────
// Caixa de seleção da campanha/anúncio. Devolve null quando o item NÃO pode ser
// selecionado (só ATIVO entra — pausar o que já está pausado não faz nada).
function _gtSelCaixa(kind,id,nome,podeSelecionar){
  if(!podeSelecionar)return null;
  const chave=kind+':'+id;
  const cb=document.createElement('input');
  cb.type='checkbox';cb.className='gt-sel-cb';
  cb.checked=_gtSelecao.has(chave);
  cb.title='Marcar para pausar junto com os outros';
  // O clique na linha da campanha ABRE/FECHA os anúncios; sem isto, marcar a
  // caixa também expandia o painel.
  cb.addEventListener('click',e=>e.stopPropagation());
  cb.addEventListener('change',()=>{
    if(cb.checked)_gtSelecao.set(chave,{kind,id,nome:nome||(kind==='ad'?'anúncio sem nome':'campanha sem nome')});
    else _gtSelecao.delete(chave);
    _gtPintarBarraSelecao();
  });
  return cb;
}
// Barra flutuante que aparece só quando há algo marcado. Vai pendurada na RAIZ
// da tela (não no body) por dois motivos: o CSS daqui é scoped, e assim ela some
// sozinha quando o usuário troca de tela.
function _gtPintarBarraSelecao(){
  const raiz=document.querySelector('.tela-gestao-trafego');
  let bar=document.getElementById('gt-massa-bar');
  if(!_gtSelecao.size||!raiz){if(bar)bar.remove();return;}
  if(!bar){bar=document.createElement('div');bar.id='gt-massa-bar';bar.className='gt-massa-bar';raiz.appendChild(bar);}
  const itens=[..._gtSelecao.values()];
  const nc=itens.filter(x=>x.kind==='campaign').length,na=itens.length-nc;
  const partes=[];
  if(nc)partes.push(nc+(nc===1?' campanha':' campanhas'));
  if(na)partes.push(na+(na===1?' anúncio':' anúncios'));
  bar.innerHTML='';
  const txt=document.createElement('div');txt.className='gt-massa-txt';
  txt.textContent='Selecionado: '+partes.join(' e ');
  const bPausar=document.createElement('button');
  bPausar.className='gt-massa-btn danger';bPausar.textContent='⏸ Pausar selecionados';
  bPausar.addEventListener('click',()=>_gtPausarSelecionados(bPausar));
  const bLimpar=document.createElement('button');
  bLimpar.className='gt-massa-btn';bLimpar.textContent='Limpar';
  bLimpar.addEventListener('click',()=>_gtLimparSelecao());
  bar.appendChild(txt);bar.appendChild(bLimpar);bar.appendChild(bPausar);
}
function _gtLimparSelecao(){
  _gtSelecao.clear();
  document.querySelectorAll('.gt-sel-cb').forEach(c=>{c.checked=false;});
  _gtPintarBarraSelecao();
}
// AÇÃO REAL EM MASSA. Mesma regra do resto da tela: confirmação ANTES de
// qualquer mutação, e aqui a confirmação LISTA nome por nome o que vai parar.
// As chamadas vão UMA DE CADA VEZ de propósito — disparar tudo junto já tomou
// rate-limit da Meta neste projeto.
async function _gtPausarSelecionados(btn){
  const tok=_gtCurAcc?.id;
  if(!tok){await _gtConfirm('Sem conta selecionada','Escolha uma conta de anúncios antes de pausar.',{okOnly:true});return;}
  const itens=[..._gtSelecao.values()];
  if(!itens.length)return;
  const lista=itens.map(it=>'<li>'+(it.kind==='campaign'?'Campanha':'Anúncio')+': <b>'+_gtEsc(it.nome)+'</b></li>').join('');
  const ok=await _gtConfirm(
    'Pausar '+itens.length+(itens.length===1?' item?':' itens de uma vez?'),
    'Vai ser PAUSADO na Meta agora:<ul style="margin:8px 0 0 18px;padding:0;">'+lista+'</ul>'
      +'<div style="margin-top:10px;">Pausar não apaga nada: para de gastar e dá pra reativar depois, um a um.</div>',
    {danger:true,okLabel:'Pausar tudo'});
  if(!ok)return;
  btn.disabled=true;
  const falhas=[];let feitos=0;
  for(const it of itens){
    btn.textContent='Pausando… '+(feitos+falhas.length+1)+'/'+itens.length;
    try{await metaPost('/'+it.id,{status:'PAUSED'},tok);feitos++;}
    catch(e){falhas.push({nome:it.nome,msg:String((e&&e.message)||e||'').slice(0,140)});}
  }
  _gtLimparSelecao();
  if(falhas.length){
    await _gtConfirm(
      'Pausados '+feitos+' de '+itens.length,
      'Não deu certo em '+falhas.length+':<ul style="margin:8px 0 0 18px;padding:0;">'
        +falhas.map(f=>'<li><b>'+_gtEsc(f.nome)+'</b> — '+_gtEsc(f.msg)+'</li>').join('')+'</ul>',
      {okOnly:true});
  }
  loadGtData();
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
  // 'otimizar' é caro por ponto: é aviso, não boa notícia — entra na mesma
  // família visual (laranja) que 'reduzir', nunca no verde de 'positivo'.
  const varClass=ver==='pausar'?'pausar':(ver==='reduzir'||ver==='otimizar')?'reduzir':'positivo';
  const sug=iaRow.budget_sugerido_centavos!=null?_maFmtR(iaRow.budget_sugerido_centavos/100):null;
  let action='';
  if(ver==='escalar'||ver==='reduzir'){
    const fromTo=(dfmt&&sug)?`<span class="gt-rec-from">${dfmt}/dia</span><span class="gt-rec-arrow">→</span><span class="gt-rec-to">${sug}<small>/dia</small></span>`:'';
    action=`<div class="gt-rec-action">${fromTo}${sug?`<button data-gt-aplicar="1" class="gt-act-btn primary">Aplicar ${sug}/dia</button>`:''}</div>`;
  }else if(ver==='manter'){
    action=`<div class="gt-rec-action"><span class="gt-rec-keep">Manter ${dfmt?dfmt+'/dia':'orçamento atual'}</span></div>`;
  }else if(ver==='otimizar'){
    // Sem número sugerido (nunca se inventa um) e sem ação automática — mas
    // não fica muda feito 'sem-dados': avisa que é o dono quem revisa.
    action=`<div class="gt-rec-action"><span class="gt-rec-keep">Sem orçamento sugerido — revisar manualmente</span></div>`;
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
// ── Selo de OBJETIVO POR INTERAÇÃO (Fase 3) ─────────────────────────────────
// Só aparece em campanha/anúncio de engajamento que NÃO seja de mensagem (o
// mesmo recorte do custo por ponto: WhatsApp já tem o resultado dele — conversa
// — e não faz sentido perguntar qual interação ele compra). Sem declaração,
// selo neutro "Objetivo: ponderado"; declarado, mostra o rótulo da interação.
// Clicar abre um menu com as quatro interações + "Voltar ao ponderado" — mesma
// linguagem visual do chip CBO/ABO (gt-nivel-chip), só que clicável.
let _gtMenuObjAberto=null;
let _gtMenuObjFechar=null; // limpeza dos listeners (clicar fora/Esc/rolar) do menu aberto agora
function _gtFecharMenuObjetivo(){
  if(_gtMenuObjFechar){_gtMenuObjFechar();_gtMenuObjFechar=null;}
  if(_gtMenuObjAberto){_gtMenuObjAberto.remove();_gtMenuObjAberto=null;}
}
// Posiciona o menu FLUTUANTE (position:fixed) em relação ao próprio selo,
// abrindo pra cima quando não sobra espaço embaixo (ver M5 do review abaixo).
function _gtPosicionarMenuObjetivo(menu,chip){
  const r=chip.getBoundingClientRect();
  const altura=menu.offsetHeight||170; // estimativa antes do 1º layout medido
  const largura=menu.offsetWidth||170; // idem, mesmo raciocínio (min-width:170px no CSS)
  const margem=8; // respiro mínimo até a borda da tela
  // B3 do review (2026-07-28): sem clamp, perto da borda direita de um celular
  // o menu nascia com left = chip.left e boa parte da largura vazava pra fora
  // da viewport — inclusive "Voltar ao ponderado", a única forma de desfazer.
  // Clampa o left pra sempre caber inteiro na tela, com uma margem mínima; o
  // flip pra cima quando não sobra espaço embaixo (abaixo) continua igual.
  const maxLeft=window.innerWidth-largura-margem;
  menu.style.left=Math.round(Math.max(margem,Math.min(r.left,maxLeft)))+'px';
  if(r.bottom+6+altura<=window.innerHeight){
    menu.style.top=Math.round(r.bottom+6)+'px';menu.style.bottom='';
  }else{
    menu.style.top='';menu.style.bottom=Math.round(window.innerHeight-r.top+6)+'px';
  }
}
function _gtAbrirMenuObjetivo(chip,alvoId,nivel){
  const mesmoChip=_gtMenuObjAberto&&_gtMenuObjAberto.__gtChip===chip;
  _gtFecharMenuObjetivo();
  if(mesmoChip)return; // clicar de novo no mesmo selo fecha o menu
  // M5 do review (2026-07-28): o menu NÃO pode morar dentro do selo. Os
  // ancestrais (.gt-camp-row, .gt-camp-row-ads) têm overflow:hidden pra conter
  // o scroll da lista, e um menu position:absolute ali dentro fica CORTADO —
  // tanto numa linha de campanha recolhida quanto no ÚLTIMO anúncio de cada
  // campanha, exatamente onde mora "Voltar ao ponderado" (a opção de baixo).
  // A saída é pendurar na RAIZ da tela (mesmo truque já usado pela barra de
  // seleção em massa, ver _gtPintarBarraSelecao) com position:fixed e
  // coordenadas calculadas do próprio selo — assim nenhum overflow:hidden de
  // ancestral alcança o menu.
  const raiz=document.querySelector('.tela-gestao-trafego');
  if(!raiz)return;
  const menu=document.createElement('div');menu.className='pnd-obj-menu';menu.__gtChip=chip;
  menu.addEventListener('click',e=>e.stopPropagation());
  const linhas=Object.keys(INTERACOES).map(k=>
    `<button type="button" class="pnd-obj-opt" data-int="${_gtEsc(k)}">${_gtEsc(INTERACOES[k].rotulo)}</button>`).join('');
  menu.innerHTML=linhas+`<button type="button" class="pnd-obj-opt pnd-obj-limpar" data-int="">Voltar ao ponderado</button>`;
  menu.querySelectorAll('.pnd-obj-opt').forEach(btn=>{
    btn.addEventListener('click',e=>{
      e.stopPropagation();
      _gtFecharMenuObjetivo();
      _gtSalvarObjetivo(alvoId,nivel,btn.dataset.int||null);
    });
  });
  raiz.appendChild(menu);
  _gtMenuObjAberto=menu;
  _gtPosicionarMenuObjetivo(menu,chip);
  // Fecha ao clicar fora, apertar Esc ou rolar qualquer parte da tela. O
  // setTimeout(...,0) é o mesmo truque de sempre (ver dropdown de contas,
  // _gtDocClick): sem ele, o PRÓPRIO clique que abriu o menu já chegaria no
  // document e fecharia na mesma hora.
  setTimeout(()=>{
    const aoClicarFora=e=>{ if(!menu.contains(e.target)) _gtFecharMenuObjetivo(); };
    const aoTeclar=e=>{ if(e.key==='Escape') _gtFecharMenuObjetivo(); };
    const aoRolar=()=>_gtFecharMenuObjetivo();
    document.addEventListener('click',aoClicarFora);
    document.addEventListener('keydown',aoTeclar);
    window.addEventListener('scroll',aoRolar,true);
    _gtMenuObjFechar=()=>{
      document.removeEventListener('click',aoClicarFora);
      document.removeEventListener('keydown',aoTeclar);
      window.removeEventListener('scroll',aoRolar,true);
    };
  },0);
}
// Devolve o <span> do selo, ou null quando este balde não é elegível (não é
// engajamento, ou é engajamento mas de mensagem). `alvoId` é o id da campanha
// OU do anúncio na Meta; `nivel` é 'campanha'|'anuncio' (grava em
// gt_objetivo_interacao.nivel).
function _gtSeloObjetivoEl(alvoId,nivel,elegivel){
  if(!elegivel)return null;
  const decl=_gtObjetivoInteracao[String(alvoId)];
  // M3 do review (2026-07-28): se a ÚLTIMA leitura de _gtCarregarObjetivos
  // falhou E este alvo não está no mapa (nunca vimos declaração dele em
  // memória), não dá pra afirmar "ponderado" — pode existir uma declaração
  // real no banco que a leitura falhou em trazer. Mostrar "ponderado" seria
  // uma mentira que o dono não tem como perceber, igual ao defeito já
  // corrigido na régua (fail-closed / _gtReguaCarregada). Escolhido um rótulo
  // neutro ("indisponível") em vez de, por ex., esconder o selo inteiro ou
  // escurecer o cartão todo — é a mudança visual MÍNIMA que ainda avisa sem
  // alarmar, e o selo continua clicável (declarar de novo não depende desta
  // leitura ter dado certo).
  const desconhecido=!decl&&!_gtObjetivoInteracaoCarregada;
  // H2(a) do review: gate de permissão igual ao resto da tela — mesmo
  // critério da RLS de escrita (admin OU feature 'meta.gestor', ver migration
  // 20260728_objetivo_por_interacao.sql). Sem isto, um usuário só-leitura
  // clicava, a escrita batia na RLS, e o toast mostrava o erro cru do
  // Postgres em vez de uma frase em português.
  const podeEditar=hasPermission('meta.gestor','editar');
  const chip=document.createElement('span');
  chip.className='pnd-obj-chip'+(decl?' declarado':'')+(podeEditar?'':' readonly');
  chip.textContent=decl
    ?('Objetivo: '+(INTERACOES[decl]?.rotulo||decl))
    :desconhecido?'Objetivo: indisponível':'Objetivo: ponderado';
  if(desconhecido){
    chip.title='Não consegui confirmar as declarações agora — recarregue antes de decidir por este selo.';
  }else if(podeEditar){
    chip.title='Declarar qual interação '+(nivel==='campanha'?'esta campanha':'este anúncio')+' está comprando';
  }else{
    chip.title='Você não tem permissão para editar esta ferramenta.';
  }
  if(podeEditar)chip.addEventListener('click',e=>{e.stopPropagation();_gtAbrirMenuObjetivo(chip,alvoId,nivel);});
  return chip;
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
      // Caixa de "pausar em massa": só para campanha ATIVA e não encerrada — é
      // exatamente o mesmo critério do botão ⏸ Pausar individual.
      const selCb=_gtSelCaixa('campaign',ins.campaign_id,ins.campaign_name||camp?.name,status==='ACTIVE'&&!encerrada);
      if(selCb)l1.appendChild(selCb);
      l1.appendChild(numEl);l1.appendChild(badge);l1.appendChild(nm);l1.appendChild(spendEl);
      const l2=document.createElement('div');l2.className='gt-camp-l2';
      const exp=document.createElement('div');exp.className='gt-camp-exp';exp.appendChild(hint);exp.appendChild(chev);
      l2.appendChild(chips);l2.appendChild(metrics);l2.appendChild(exp);
      top.appendChild(l1);top.appendChild(l2);
      // PONDERADA: pontos e custo por ponto desta campanha, com a régua do dono.
      const qtdsPnd = quantidadesDoInsight(ins);
      const baldeCamp = _gtBalde(kpiObjective);
      // Campanha de MENSAGEM (WhatsApp/Direct) nunca pode ter o veredito decidido
      // pela ponderada, mesmo caindo no balde 'engajamento': no setup moderno da
      // Meta, WhatsApp chega como objetivo OUTCOME_ENGAGEMENT (ver GT_OBJETIVO_BALDE),
      // então herdaria a meta de engajamento — mas o que essa campanha VENDE é
      // conversa, não curtida/comentário/salvamento. Medindo campanhas reais, o
      // custo por ponto delas ficou entre R$ 2,97 e R$ 7,21 — pintaria de vermelho
      // campanhas que estão indo bem no que de fato prometem, só porque engajamento
      // não é o que compram. Mesma classe de defeito já corrigida pra vendas/leads
      // (ver comentário na migration 20260728_ponderada_config.sql): a correção
      // aqui é tratar como "sem meta" (meta=0) qualquer campanha de ENGAJAMENTO
      // com ação de mensagem — calcularPonderada devolve faixa 'sem-dados' e
      // decidirVeredito cai pra saúde/objetivo, sem mexer em decidirVeredito nem
      // no formato dos campos. O custo por ponto continua calculado e aparecendo
      // no cartão (custoPorPonto não depende da meta) — só o VEREDITO deixa de
      // ser guiado por ele.
      // O `&& baldeCamp==='engajamento'` é o que restringe este desvio ao caso
      // real (WhatsApp chegando como engajamento): uma campanha de LEAD ou de
      // TRÁFEGO que também dispara uma ação de mensagem (ex.: roteia pro
      // WhatsApp) já tem o alvo certo do seu PRÓPRIO balde — sem essa restrição,
      // esse desvio sequestrava um alvo correto que o dono acabou de ganhar
      // (I5 do review final, 2026-07-28).
      const temMensagem = baldeCamp === 'engajamento' && (
        _gtActionVal(ins, _GT_MSG) != null
        || _gtActionVal(ins, _GT_MSG_CONN) != null
        || _gtActionVal(ins, _GT_MSG_REPLY) != null
      );
      // Selo de objetivo por interação (Fase 3): só campanha de engajamento que
      // NÃO seja de mensagem pode declarar qual interação está comprando —
      // mesmo recorte do custo por ponto logo abaixo.
      const elegivelSeloObj = baldeCamp === 'engajamento' && !temMensagem;
      const seloObjEl = _gtSeloObjetivoEl(ins.campaign_id, 'campanha', elegivelSeloObj);
      if (seloObjEl) chips.appendChild(seloObjEl);
      // O índice "custo por ponto" só existe pra engajamento — é o único balde
      // cujo resultado É o ponto da ponderada. Fora dele, dividir R$/ponto por
      // uma meta de outra unidade (R$/visita, R$/lead...) seria comparar
      // maçã com laranja: o chip pintava verde/vermelho contradizendo o
      // veredito do mesmo cartão (C2 do review final, 2026-07-28). meta=0 aqui
      // faz calcularPonderada devolver faixa 'sem-dados' (cor neutra), mas o
      // custo por ponto em si continua calculado e aparecendo — é informação,
      // não veredito.
      const metaPnd = (baldeCamp === 'engajamento' && !temMensagem) ? metaDoBalde(_gtRegua, 'engajamento') : 0;
      const pnd = calcularPonderada(qtdsPnd, { pesos: _gtRegua.pesos, limiares: _gtRegua.limiares, meta: metaPnd });

      // ALVO DO OBJETIVO: cada tipo de campanha é medido pelo resultado que ele
      // compra (lead, conversa, venda, visita, mil impressões) — e engajamento
      // pelo ponto da ponderada. A conta de cada um já existe no catálogo
      // (GT_METRIC_CATALOG). Campanha com resultado de mensagem entra como
      // 'mensagens' mesmo chegando com objetivo de engajamento — mesma correção
      // de sempre (ver comentário de temMensagem acima), só que agora em vez de
      // simplesmente cair fora da conta, ela ganha o alvo certo: custo por conversa.
      const alvo = temMensagem ? alvoDoBalde('mensagens') : alvoDoBalde(baldeCamp);
      let metaAlvo = metaDoBalde(_gtRegua, temMensagem ? 'mensagens' : baldeCamp);
      let custoAlvo = !alvo ? null
        : alvo.metrica === 'ponderada' ? pnd.custoPorPonto
        : _gtMetricValue(alvo.metrica, ins);
      let rotuloAlvo = alvo;
      // OBJETIVO DECLARADO (Fase 3, Task 4): se o dono declarou, NESTA
      // campanha, qual interação ela compra, o veredito passa a julgar por
      // ESSE mercado — custo da interação declarada (custoDaInteracao, que
      // NUNCA inventa número: quantidade zero devolve null, não R$ 0,00)
      // contra a meta DAQUELA interação (metaDoBalde) — em vez do ponto
      // ponderado, que é 83% curtida em volume. Sem declaração
      // (_gtObjetivoInteracao vazio para este id), objDeclarado é null e nada
      // muda: segue com o alvo/meta/custo de sempre, calculados acima.
      const objDeclaradoBruto = elegivelSeloObj ? _gtObjetivoInteracao[String(ins.campaign_id)] : null;
      // Guarda (L7 do review, 2026-07-28): o CHECK constraint da tabela é a
      // única coisa que impede um valor fora das 4 interações de chegar aqui —
      // mas se algum dia escapar (linha antiga, edição direta no banco), indexar
      // INTERACOES[valor] sem checar antes derruba o forEach INTEIRO da lista de
      // campanhas. O caminho do anúncio (mais abaixo) já tinha esse cuidado.
      const objDeclarado = interacaoValida(objDeclaradoBruto) ? objDeclaradoBruto : null;
      if (objDeclarado) {
        custoAlvo = custoDaInteracao(qtdsPnd, objDeclarado);
        metaAlvo = metaDoBalde(_gtRegua, objDeclarado);
        rotuloAlvo = { rotulo: INTERACOES[objDeclarado].rotuloCusto };
      }
      const aval = avaliarAlvo({ custo: custoAlvo, meta: metaAlvo, limiares: _gtRegua.limiares });

      // VEREDITO ÚNICO (ver veredito.js): saúde veta > Opus > ponderada.
      // _gtRegraCampanha continua sendo a leitura de SAÚDE (frequência, CTR).
      const saudePnd = (!encerrada && status === 'ACTIVE') ? _gtRegraCampanha(camp, ins, insights) : null;
      const opusPnd = _gtBudgetIA[ins.campaign_id] || null;
      const decisao = decidirVeredito({
        saude: saudePnd,
        opus: opusPnd,
        // O veredito agora vem do ALVO do objetivo da campanha (custo por lead,
        // por conversa, por venda, por visita, por mil pessoas — ou por ponto,
        // no caso de engajamento), não mais sempre da ponderada. decidirVeredito
        // não muda: ele só lê faixa/custoPorPonto/meta, quaisquer que sejam.
        // `rotulo` é novo (I3 do review final, 2026-07-28): a unidade certa pra
        // frase do veredito ("Caro por conversa iniciada", não sempre "por
        // ponto") — vem do mesmo ALVOS[balde].rotulo que a régua já usa.
        ponderada: { faixa: aval.faixa, custoPorPonto: custoAlvo, meta: metaAlvo, rotulo: _gtRotuloPorUnidade(rotuloAlvo) },
      });

      // A faixa continua recebendo o formato que ela já espera hoje.
      // O orçamento sugerido só pode vir de quem REALMENTE decidiu o veredito
      // (decisao.origem) — nunca da fonte que perdeu a disputa. Se foi a
      // ponderada ou a saúde que decidiram, não existe número confiável pra
      // sugerir (a ponderada nunca inventa um valor multiplicando o atual; a
      // saúde só decide no veto de pausa ou emprestando o veredito quando não
      // há mais nada — nenhum dos dois casos tem orçamento pra aplicar).
      const iaRow = decisao.veredito === 'sem-dados' ? null : {
        veredito: decisao.veredito,
        justificativa: decisao.porque,
        budget_sugerido_centavos: decisao.origem === 'opus' ? ((opusPnd && opusPnd.budget_sugerido_centavos) || null) : null,
        // "Impacto:" no cartão também só faz sentido quando foi o Opus quem decidiu
        // (é a estimativa da análise semanal dele) — mesma regra do budget acima.
        impacto_estimado: decisao.origem === 'opus' ? ((opusPnd && opusPnd.impacto_estimado) || null) : null,
      };
      // Custo por ponto aparece SEMPRE, independente de quem deu o veredito:
      // é informação, não decisão.
      if (pnd.custoPorPonto != null) {
        // M4 do review (2026-07-28): campanha DECLARADA não pode mais ser
        // pintada pelo ranking do ponto — é exatamente o ranking que esta fase
        // considera errado pra ela. Sem isto, o cartão podia mostrar "Dentro da
        // meta" no veredito (julgado pela interação declarada) com este chip
        // do lado pintado de VERMELHO pelo ponto — uma contradição visual do
        // mesmo tipo já rejeitada num review anterior (C2). O chip continua
        // visível como referência (ainda é informação real), só deixa de
        // afirmar um julgamento que o cartão não segue mais.
        const cor = objDeclarado ? 'var(--muted)'
          : pnd.faixa === 'escalar-forte' || pnd.faixa === 'dentro-da-meta' ? 'var(--green)'
          : pnd.faixa === 'manter' ? 'var(--orange)' : pnd.faixa === 'otimizar' ? 'var(--red)' : 'var(--muted)';
        const extra = document.createElement('div');
        extra.className = 'gt-metric';
        extra.title = objDeclarado
          ? `${_maFmt(pnd.pontos, 0)} pontos · cada interação vale ${_maFmt(pnd.qualidade, 1)} · cor neutra porque esta campanha foi declarada e é julgada por ${INTERACOES[objDeclarado].rotulo.toLowerCase()}, não por ponto`
          : `${_maFmt(pnd.pontos, 0)} pontos · cada interação vale ${_maFmt(pnd.qualidade, 1)}`;
        extra.innerHTML = `Custo/ponto <span style="color:${cor}">${_maFmtR(pnd.custoPorPonto)}</span>`;
        metrics.appendChild(extra);
      }
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
      // H1 do review (2026-07-28): `temMensagem` desce até o anúncio em vez de
      // ser recalculado lá. A Meta OMITE um action_type inteiro quando a
      // contagem é zero — um anúncio de uma campanha de WhatsApp que gastou mas
      // não puxou conversa NA JANELA fica com `actions` idêntico ao de um
      // anúncio de engajamento puro. Calculado por anúncio, esse anúncio virava
      // "elegível" pro selo de interação, e o dono podia declarar "Salvamento"
      // nele — comparando, no mesmo mercado de salvamento, um anúncio cujo
      // produto real é conversa. A CAMPANHA é a unidade certa pra essa decisão.
      adsPane.__gtRender=()=>_renderGtConjuntos(adsPane,hier,camp,conjuntos,nivelOrc,i+1,temMensagem);
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
// Troca de aba: só mostra/esconde painel. NÃO remonta a lista de campanhas —
// remontar dispararia chamadas à Meta de novo e pode custar rate-limit.
function _gtTrocarAba(nome) {
  _gtAbaAtiva = nome;
  for (const n of ['campanhas', 'regua']) {
    const painel = document.getElementById('gt-painel-' + n);
    const aba = document.getElementById('pnd-aba-' + n);
    if (painel) painel.style.display = (n === nome) ? '' : 'none';
    if (aba) aba.classList.toggle('ativa', n === nome);
  }
  if (nome === 'regua') {
    const alvo = document.getElementById('gt-painel-regua');
    if (alvo) montarPainelRegua(alvo, {
      regua: _gtRegua,
      // Mesmo critério do RLS (admin OU feature 'meta.gestor' — ver migration
      // 20260728_ponderada_config.sql): editar a régua é uma ação de quem tem
      // permissão de EDITAR nesta ferramenta, não um privilégio exclusivo de
      // admin. Usar outro critério aqui faria os campos aparecerem editáveis
      // pra quem não consegue salvar de fato (ou o oposto: escondidos de quem
      // pode).
      editavel: hasPermission('meta.gestor', 'editar'),
      // Só true quando _gtCarregarRegua() leu o banco com sucesso. Se ainda não
      // (ou se falhou), o painel mostra os campos mas trava o "Salvar" — nunca
      // deixa gravar um valor que pode não ser o real (ver C3 do review final).
      carregouOk: _gtReguaCarregada,
      exemplos: _gtExemplosParaRegua(),
      aoSalvar: _gtSalvarRegua,
    });
  }
}
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
function _renderGtConjuntos(pane,hier,camp,conjuntos,nivelOrc,campNum,temMensagemCampanha){
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
    adsPane.__gtRender=()=>_renderGtAds(adsPane,g.anuncios,null,null,num,temMensagemCampanha);
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
function _renderGtAds(pane,ads,allInsights,allAdInsights,campNum,temMensagemCampanha){
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
    // Selo de objetivo por interação (Fase 3, Task 4): mesmo recorte da
    // campanha — só anúncio de engajamento que NÃO seja de mensagem pode
    // declarar. Nota: hoje o anúncio NÃO tem um veredito por custo-vs-meta
    // (o selo do topo acima é a regra de saúde CTR/frequência, _gtRegraAnuncio,
    // ou o Opus — nenhum dos dois é "custo por resultado"), então declarar
    // aqui grava a preferência e pinta o selo, mas não existe, hoje, um
    // veredito de custo do anúncio para redirecionar — só a campanha tem essa
    // peça (ver _gtSeloObjetivoEl acima e o bloco "OBJETIVO DECLARADO" em
    // _renderGtCampaigns).
    // "É de mensagem?" vem PRONTO da campanha (temMensagemCampanha, ver H1 do
    // review 2026-07-28) — NÃO recalculado a partir das actions do PRÓPRIO
    // anúncio. A Meta omite o action_type inteiro quando a contagem é zero, e
    // um anúncio de WhatsApp que não puxou conversa nesta janela ficaria com
    // `actions` idêntico ao de engajamento puro, abrindo o selo pra declarar
    // "Salvamento" num anúncio cujo produto de verdade é conversa.
    const baldeAd = _gtBalde(ad.objective || '');
    const seloObjAd = _gtSeloObjetivoEl(ad.ad_id, 'anuncio', baldeAd === 'engajamento' && !temMensagemCampanha);
    if (seloObjAd) nameWrap.appendChild(seloObjAd);
    const metrics=document.createElement('div');metrics.className='gt-metrics';
    metrics.innerHTML=`<div class="gt-metric">CTR <span style="color:${ctrColor}">${_maFmtPct(ctr)}</span></div><div class="gt-metric" style="font-family:var(--fonte-principal);font-size:calc(13px*var(--gt-fs,1.3));font-weight:700;"><span>${_maFmtR(spend)}</span></div>`;
    // Declarada a interação no anúncio, o número dela aparece AQUI, com a cor da
    // faixa. O anúncio não tem (e não passa a ter) um veredito por custo-vs-meta
    // próprio — a pílula do topo continua sendo a leitura de saúde/Opus. Mas sem
    // mostrar o custo daquilo que o dono declarou, declarar no anúncio não faria
    // nada visível, e ele pediu que valesse pro anúncio também.
    const declAd=_gtObjetivoInteracao[String(ad.ad_id)];
    if(interacaoValida(declAd)){
      const qAd=quantidadesDoInsight(ad);
      const custoAd=custoDaInteracao(qAd,declAd);
      const metaAd=metaDoBalde(_gtRegua,declAd);
      const avalAd=avaliarAlvo({custo:custoAd,meta:metaAd,limiares:_gtRegua.limiares});
      const corAd=avalAd.faixa==='escalar-forte'||avalAd.faixa==='dentro-da-meta'?'var(--green)'
        :avalAd.faixa==='manter'?'var(--orange)':avalAd.faixa==='otimizar'?'var(--red)':'var(--muted)';
      const el=document.createElement('div');
      el.className='gt-metric';
      el.title=`${INTERACOES[declAd].rotuloCusto} · sua meta é ${metaAd>0?_maFmtR(metaAd):'—'}`;
      el.innerHTML=`${_gtEsc(INTERACOES[declAd].rotulo)} <span style="color:${corAd}">${custoAd==null?'—':_maFmtR(custoAd)}</span>`;
      metrics.appendChild(el);
    }
    const adNum=document.createElement('div');adNum.className='gt-ad-num';adNum.textContent=(campNum!=null?campNum+'.':'')+(ai+1);
    const adSelCb=_gtSelCaixa('ad',ad.ad_id,ad.ad_name||ad.adset_name,adStatus==='ACTIVE');
    if(adSelCb)top.appendChild(adSelCb);
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
  _gtSelecao.clear();
  const barra=document.getElementById('gt-massa-bar');if(barra)barra.remove();
  document.removeEventListener('click',_gtDocClick);
  document.removeEventListener('keydown',_gtCrEsc);
  // M5: o menu de objetivo por interação agora mora na raiz da tela (não mais
  // dentro do selo) — sem fechar aqui, sair da tela com o menu aberto deixaria
  // os listeners de clicar-fora/Esc/rolar (document/window) vazando.
  _gtFecharMenuObjetivo();
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
  // A régua (gt_ponderada_config) é UMA linha única, sem relação com qual conta de
  // anúncios está selecionada — por isso carrega aqui, já no mount, e não só dentro
  // de loadGtData() (que devolve cedo sem conta selecionada). Sem isto, a aba "A
  // régua" é clicável desde o primeiro instante mas fica com o padrão de fábrica
  // até uma conta ser escolhida — e "Salvar" ali gravaria esse padrão por cima da
  // régua real das cinco contas (ver C3 do review final, 2026-07-28).
  _gtCarregarRegua()
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
  _gtTrocarAba,
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

/* Abas da ferramenta. Prefixo .pnd- próprio: nomes globais vazam pra dentro de
   telas scoped neste projeto e já causaram bug antes. */
/* Abas: um CONTROLE SEGMENTADO (trilho único com a aba ativa em relevo), não dois
   botões soltos com borda cada. Dois botões contornados lado a lado brigavam com as
   pílulas de período e de status logo acima — o trilho deixa claro que é uma escolha
   entre duas telas, não mais um filtro. */
/* Abas no MESMO padrão da Gestão Comercial (.gc-tabs): sublinhado, maiúsculas,
   sem caixa nem pílula. O dono já aprovou aquele lá; ter dois desenhos de aba na
   mesma casa é o que fazia esta parecer mais um filtro. */
.tela-gestao-trafego :deep(.pnd-abas){display:flex;gap:4px;padding:2px 4px 0;margin-bottom:16px;border-bottom:1px solid var(--border);flex-wrap:wrap;}
.tela-gestao-trafego :deep(.pnd-aba){appearance:none;background:none;border:none;border-bottom:2px solid transparent;margin-bottom:-1px;padding:9px 16px;font-family:var(--fonte-principal);font-size:calc(11px*var(--gt-fs,1.3));font-weight:500;letter-spacing:1.4px;text-transform:uppercase;color:var(--muted);cursor:pointer;transition:color .15s ease,border-color .15s ease;}
.tela-gestao-trafego :deep(.pnd-aba:hover){color:var(--text);}
.tela-gestao-trafego :deep(.pnd-aba.ativa){color:var(--accent);border-bottom-color:var(--accent);}

/* Aba "A régua" (ver painel-regua.js).
   Composição: os três cartões de ajuste ocupam a área principal e fluem de 1 a 3
   colunas conforme a largura; o EXEMPLO VIVO fica numa faixa própria à direita e
   GRUDADO no topo (sticky) — ele é o retorno visual de cada tecla digitada, então
   precisa continuar à vista enquanto se rola e se edita. Antes as tabelas ficavam
   numa coluna e o exemplo sozinho na outra, deixando um vazio enorme ao lado. */
.tela-gestao-trafego :deep(.pnd-regua){display:grid;grid-template-columns:minmax(0,1fr) minmax(290px,370px);gap:18px;align-items:start;}
.tela-gestao-trafego :deep(.pnd-cards){display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:14px;}
.tela-gestao-trafego :deep(.pnd-bloco){background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px 18px;}
.tela-gestao-trafego :deep(.pnd-cab){display:flex;align-items:center;gap:8px;margin-bottom:5px;}
.tela-gestao-trafego :deep(.pnd-cab::before){content:'';width:3px;height:14px;border-radius:2px;background:var(--accent);flex:0 0 auto;}
.tela-gestao-trafego :deep(.pnd-titulo){font-family:var(--fonte-principal);font-size:calc(12px*var(--gt-fs,1.3));font-weight:700;letter-spacing:.2px;color:var(--text);margin:0;}
.tela-gestao-trafego :deep(.pnd-ajuda){font-family:var(--fonte-principal);font-size:calc(10px*var(--gt-fs,1.3));color:var(--muted);margin:0 0 12px;line-height:1.55;}
.tela-gestao-trafego :deep(.pnd-tabela){width:100%;border-collapse:collapse;}
.tela-gestao-trafego :deep(.pnd-tabela td){padding:8px 0;border-bottom:1px solid var(--border);font-family:var(--fonte-principal);font-size:calc(11px*var(--gt-fs,1.3));color:var(--text);line-height:1.35;}
.tela-gestao-trafego :deep(.pnd-tabela tr:last-child td){border-bottom:none;padding-bottom:0;}
.tela-gestao-trafego :deep(.pnd-tabela td:last-child){text-align:right;white-space:nowrap;width:1%;padding-left:12px;}
.tela-gestao-trafego :deep(.pnd-destaque td){font-weight:800;}
/* Ocupa a lateral inteira (regra da casa: nada de max-width estreito centralizado).
   Em tela larga os parágrafos vão para DUAS COLUNAS — assim usa toda a extensão
   sem virar uma linha de 200 caracteres, que ninguém lê até o fim. */
.tela-gestao-trafego :deep(.pnd-intro){background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:14px;padding:16px 20px;margin-bottom:18px;}
@media (min-width:1100px){
  .tela-gestao-trafego :deep(.pnd-intro-corpo){column-count:2;column-gap:34px;}
  .tela-gestao-trafego :deep(.pnd-intro-corpo p){break-inside:avoid;}
}
.tela-gestao-trafego :deep(.pnd-intro-tit){font-family:var(--fonte-principal);font-size:calc(12px*var(--gt-fs,1.3));font-weight:700;color:var(--text);margin:0 0 8px;}
.tela-gestao-trafego :deep(.pnd-intro p){font-family:var(--fonte-principal);font-size:calc(11px*var(--gt-fs,1.3));color:var(--muted);line-height:1.6;margin:0 0 7px;}
.tela-gestao-trafego :deep(.pnd-intro p:last-child){margin-bottom:0;}
.tela-gestao-trafego :deep(.pnd-alvo-nome){font-weight:600;}
.tela-gestao-trafego :deep(.pnd-alvo-ajuda){font-size:calc(9.5px*var(--gt-fs,1.3));color:var(--muted);line-height:1.45;margin-top:3px;max-width:44ch;}
.tela-gestao-trafego :deep(.pnd-alvo-vazio){font-size:calc(9.5px*var(--gt-fs,1.3));color:var(--orange);line-height:1.45;margin-top:3px;font-style:italic;}
/* Campo: a caixa é que tem a borda, e o prefixo (R$ ou ×) mora DENTRO dela — assim
   dá pra ler "R$ 0,15" como uma coisa só, em vez de um número solto sem unidade. */
.tela-gestao-trafego :deep(.pnd-campo){display:inline-flex;align-items:center;gap:5px;border:1px solid var(--border);border-radius:9px;background:var(--surface2);padding:0 9px;transition:border-color .15s,box-shadow .15s;}
.tela-gestao-trafego :deep(.pnd-campo:focus-within){border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-light);}
.tela-gestao-trafego :deep(.pnd-pre){font-family:var(--fonte-dados);font-size:calc(10px*var(--gt-fs,1.3));color:var(--muted);}
/* Número em fonte de dados (IBM Plex Mono), como no resto da casa: dígito com
   largura fixa faz a coluna de valores alinhar sozinha. */
.tela-gestao-trafego :deep(.pnd-input){width:62px;padding:6px 0;border:none;background:none;color:var(--text);font-family:var(--fonte-dados);font-size:calc(12px*var(--gt-fs,1.3));text-align:right;outline:none;}
.tela-gestao-trafego :deep(.pnd-input::-webkit-outer-spin-button),
.tela-gestao-trafego :deep(.pnd-input::-webkit-inner-spin-button){-webkit-appearance:none;margin:0;}
.tela-gestao-trafego :deep(.pnd-valor){font-family:var(--fonte-dados);font-size:calc(12px*var(--gt-fs,1.3));font-weight:600;}
/* "Sem meta de propósito" virou UMA nota no rodapé do cartão (ver M do review final,
   2026-07-28). Como linha de tabela, o texto quebrava em quatro e inchava a linha. */
.tela-gestao-trafego :deep(.pnd-nota){margin:12px 0 0;padding-top:11px;border-top:1px dashed var(--border);font-family:var(--fonte-principal);font-size:calc(9.5px*var(--gt-fs,1.3));color:var(--muted);line-height:1.5;}
.tela-gestao-trafego :deep(.pnd-salvar){margin-top:16px;padding:10px 22px;border-radius:22px;border:none;background:var(--accent);color:#fff;font-family:var(--fonte-principal);font-size:calc(11px*var(--gt-fs,1.3));font-weight:700;cursor:pointer;transition:filter .15s,transform .1s;}
.tela-gestao-trafego :deep(.pnd-salvar:hover:not(:disabled)){filter:brightness(1.08);}
.tela-gestao-trafego :deep(.pnd-salvar:active:not(:disabled)){transform:translateY(1px);}
.tela-gestao-trafego :deep(.pnd-salvar:disabled){opacity:.65;cursor:default;}

/* Exemplo vivo: o resultado vem em manchete, não escondido numa linha de tabela. */
/* Exemplo vivo: UM bloco por objetivo que a conta roda. A faixa gruda no topo e
   rola por dentro quando passa da altura da tela — são até 6 blocos. */
.tela-gestao-trafego :deep(.pnd-exemplo){position:sticky;top:14px;max-height:calc(100vh - 28px);overflow-y:auto;display:flex;flex-direction:column;gap:12px;}
.tela-gestao-trafego :deep(.pnd-ex-cab){padding:0 2px;}
.tela-gestao-trafego :deep(.pnd-ex-cab-tit){font-family:var(--fonte-principal);font-size:calc(11px*var(--gt-fs,1.3));font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:var(--accent);}
.tela-gestao-trafego :deep(.pnd-ex-cab-sub){font-family:var(--fonte-principal);font-size:calc(10px*var(--gt-fs,1.3));color:var(--muted);line-height:1.5;margin-top:4px;}
/* Bloco de INTERAÇÃO usa borda discreta: são exemplos de apoio às metas por
   curtida/comentário/salvamento/compartilhamento, abaixo dos objetivos de
   resultado, que são a leitura principal. */
.tela-gestao-trafego :deep(.pnd-ex-bloco.interacao){border-color:var(--border);}
.tela-gestao-trafego :deep(.pnd-ex-bloco.interacao .pnd-ex-topo){background:var(--surface2);}
.tela-gestao-trafego :deep(.pnd-ex-bloco.interacao .pnd-ex-rot){color:var(--muted);}
.tela-gestao-trafego :deep(.pnd-ex-bloco){background:var(--surface);border:1px solid var(--accent-mid);border-radius:14px;overflow:hidden;flex:0 0 auto;}
.tela-gestao-trafego :deep(.pnd-ex-topo){padding:14px 16px 13px;background:var(--accent-light);border-bottom:1px solid var(--border);}
.tela-gestao-trafego :deep(.pnd-ex-rot){font-family:var(--fonte-principal);font-size:calc(9px*var(--gt-fs,1.3));font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--accent);margin-bottom:6px;}
.tela-gestao-trafego :deep(.pnd-ex-nome){font-family:var(--fonte-principal);font-size:calc(10.5px*var(--gt-fs,1.3));font-weight:600;color:var(--text);line-height:1.4;margin-bottom:10px;}
.tela-gestao-trafego :deep(.pnd-ex-num){font-family:var(--fonte-dados);font-size:calc(26px*var(--gt-fs,1.3));font-weight:600;line-height:1;letter-spacing:-1px;color:var(--text);}
.tela-gestao-trafego :deep(.pnd-ex-leg){font-family:var(--fonte-principal);font-size:calc(9.5px*var(--gt-fs,1.3));color:var(--muted);margin-top:5px;}
.tela-gestao-trafego :deep(.pnd-ex-selo){display:inline-block;margin-top:10px;padding:4px 12px;border-radius:20px;font-family:var(--fonte-principal);font-size:calc(9.5px*var(--gt-fs,1.3));font-weight:700;}
.tela-gestao-trafego :deep(.pnd-ex-selo.bom){background:rgba(22,163,74,.13);color:var(--green);}
.tela-gestao-trafego :deep(.pnd-ex-selo.meio){background:rgba(245,158,11,.15);color:var(--orange);}
.tela-gestao-trafego :deep(.pnd-ex-selo.ruim){background:rgba(220,38,38,.12);color:var(--red);}
.tela-gestao-trafego :deep(.pnd-ex-selo.neutro){background:var(--surface2);color:var(--muted);}
/* "Onde a cor vira" em REAIS: multiplicador (0,8/1,0/1,3) é abstrato; o valor se lê. */
.tela-gestao-trafego :deep(.pnd-ex-regua){margin-top:12px;padding-top:10px;border-top:1px solid var(--border);}
.tela-gestao-trafego :deep(.pnd-ex-corte){display:flex;align-items:center;gap:7px;font-family:var(--fonte-principal);font-size:calc(9.5px*var(--gt-fs,1.3));color:var(--text);line-height:1.85;}
.tela-gestao-trafego :deep(.pnd-ponto){width:7px;height:7px;border-radius:50%;flex:0 0 auto;}
.tela-gestao-trafego :deep(.pnd-ponto.bom){background:var(--green);}
.tela-gestao-trafego :deep(.pnd-ponto.meio){background:var(--orange);}
.tela-gestao-trafego :deep(.pnd-ponto.ruim){background:var(--red);}
.tela-gestao-trafego :deep(.pnd-ex-corpo){padding:12px 16px 14px;}
.tela-gestao-trafego :deep(.pnd-ex-corpo .pnd-tabela td){font-size:calc(10px*var(--gt-fs,1.3));padding:5px 0;color:var(--muted);}
.tela-gestao-trafego :deep(.pnd-ex-corpo .pnd-tabela td:last-child){font-family:var(--fonte-dados);font-weight:600;color:var(--text);}
.tela-gestao-trafego :deep(.pnd-ex-corpo .pnd-tabela tr.forte td){font-weight:700;color:var(--text);}
@media (max-width:900px){
  /* No celular a faixa do exemplo desce pro fim e para de grudar; e as abas ocupam
     a largura toda, como o resto da tela já faz. */
  .tela-gestao-trafego :deep(.pnd-regua){grid-template-columns:1fr;}
  .tela-gestao-trafego :deep(.pnd-exemplo){position:static;}
  .tela-gestao-trafego :deep(.pnd-abas){display:flex;width:calc(100% - 8px);}
  .tela-gestao-trafego :deep(.pnd-aba){flex:1;padding:9px 8px;}
}

/* ── Loading state (compartilhado com Gestão à Vista/Análise de Campanhas — cada tela traz sua cópia) ── */
.tela-gestao-trafego :deep(.gv-loading-screen){grid-column:1/-1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;min-height:60vh;}
@keyframes gtSpin{to{transform:rotate(360deg)}}
.tela-gestao-trafego :deep(.gv-spinner){width:48px;height:48px;border-radius:50%;border:3px solid var(--border);border-top-color:var(--accent);animation:gtSpin .9s linear infinite;}
.tela-gestao-trafego :deep(.gv-loading-lbl){font-family:var(--fonte-principal);font-size:10px;letter-spacing:4px;text-transform:uppercase;color:var(--muted);opacity:.6;}

/* ── Chip de objetivo (compartilhado com Análise de Campanhas — cada tela traz sua cópia) ── */
.tela-gestao-trafego :deep(.ma-obj-chip){font-family:var(--fonte-principal);font-size:9px;font-weight:600;letter-spacing:.5px;padding:2px 6px;border-radius:3px;background:var(--surface2);color:var(--muted);text-transform:uppercase;}

/* ── GESTÃO DE TRÁFEGO — CSS próprio (legacy/index.html L2350-2477, íntegro) ── */
/* #gt-painel-campanhas é só o alvo do toggle de aba — "display:contents" tira ele
   da árvore de layout (some como caixa, mas os filhos continuam no DOM), então
   .gt-body é quem vira o item flex de verdade dentro de .tela-gestao-trafego e
   mantém seu flex:1 + overflow-y:auto (ver I3 do review final, 2026-07-28). */
.tela-gestao-trafego :deep(#gt-painel-campanhas){display:contents;}
/* A aba "A régua" é irmã de #gt-painel-campanhas no mesmo flex column, então
   precisa da MESMA mecânica de preencher e rolar sozinha — e do mesmo padding
   lateral que .gt-body usa, senão o conteúdo cola na borda da tela (ver M1). */
.tela-gestao-trafego :deep(#gt-painel-regua){flex:1;overflow-y:auto;padding:20px 28px;}
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
/* Selo de OBJETIVO POR INTERAÇÃO (Fase 3): mesma linguagem visual do chip
   CBO/ABO acima, só que clicável (abre o menu de escolha) — position:relative
   pra segurar o menu suspenso ancorado nele. */
.tela-gestao-trafego :deep(.pnd-obj-chip){position:relative;display:inline-block;margin-top:3px;font-family:var(--fonte-principal);font-size:calc(9px*var(--gt-fs,1.3));font-weight:700;letter-spacing:.3px;padding:2px 8px;border-radius:20px;white-space:nowrap;flex-shrink:0;cursor:pointer;background:var(--surface2);color:var(--muted);border:1px solid var(--border);transition:filter .15s;}
.tela-gestao-trafego :deep(.pnd-obj-chip:hover){filter:brightness(1.08);}
.tela-gestao-trafego :deep(.pnd-obj-chip.declarado){background:var(--accent-light);color:var(--accent);border-color:transparent;}
/* H2(a): sem permissão de editar, o selo só informa — sem cursor de clique nem
   destaque de hover (o listener de clique nem é ligado em _gtSeloObjetivoEl). */
.tela-gestao-trafego :deep(.pnd-obj-chip.readonly){cursor:default;}
.tela-gestao-trafego :deep(.pnd-obj-chip.readonly:hover){filter:none;}
/* M5: position:fixed (não mais absolute dentro do selo) — o menu agora é
   filho da RAIZ da tela (.tela-gestao-trafego), pendurado ali por JS
   (_gtAbrirMenuObjetivo) bem no clique, com left/top/bottom calculados de
   chip.getBoundingClientRect(). Isso tira o menu de dentro de qualquer
   ancestral com overflow:hidden (.gt-camp-row, .gt-camp-row-ads) — que antes
   cortava a parte de baixo do menu (incluindo "Voltar ao ponderado") sempre
   que o selo estava perto do fim de uma linha recolhida ou do último anúncio
   de uma campanha. */
.tela-gestao-trafego :deep(.pnd-obj-menu){position:fixed;min-width:170px;background:var(--surface);border:1px solid var(--border);border-radius:9px;box-shadow:0 8px 24px rgba(0,0,0,.18);z-index:1000;overflow:hidden;display:flex;flex-direction:column;cursor:default;}
.tela-gestao-trafego :deep(.pnd-obj-opt){appearance:none;border:none;background:none;text-align:left;padding:8px 12px;font-family:var(--fonte-principal);font-size:calc(10.5px*var(--gt-fs,1.3));font-weight:600;letter-spacing:.2px;color:var(--text);cursor:pointer;white-space:nowrap;}
.tela-gestao-trafego :deep(.pnd-obj-opt:hover){background:var(--surface2);}
.tela-gestao-trafego :deep(.pnd-obj-opt.pnd-obj-limpar){border-top:1px solid var(--border);color:var(--muted);}
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
/* Pausar em massa: caixa de seleção + barra flutuante.
   A barra fica pendurada na RAIZ da tela (não no body) — o CSS aqui é scoped e,
   de quebra, ela some sozinha quando a tela é desmontada. */
.tela-gestao-trafego :deep(.gt-sel-cb){width:16px;height:16px;flex:0 0 auto;margin:0;cursor:pointer;accent-color:#dc2626;}
.tela-gestao-trafego :deep(.gt-massa-bar){position:fixed;left:50%;transform:translateX(-50%);bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:9998;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;max-width:calc(100vw - 24px);padding:10px 14px;border-radius:14px;background:var(--surface);border:1px solid var(--border);box-shadow:0 16px 40px rgba(0,0,0,.28);font-family:var(--fonte-principal);}
.tela-gestao-trafego :deep(.gt-massa-txt){font-size:calc(12px*var(--gt-fs,1.3));font-weight:700;color:var(--text);}
.tela-gestao-trafego :deep(.gt-massa-btn){padding:7px 14px;border-radius:20px;font-family:var(--fonte-principal);font-size:calc(11px*var(--gt-fs,1.3));font-weight:700;cursor:pointer;border:1px solid var(--border);background:none;color:var(--text);white-space:nowrap;transition:all .15s;}
.tela-gestao-trafego :deep(.gt-massa-btn:hover){border-color:var(--accent);color:var(--accent);background:var(--accent-light);}
.tela-gestao-trafego :deep(.gt-massa-btn.danger){border-color:#dc2626;background:#dc2626;color:#fff;}
.tela-gestao-trafego :deep(.gt-massa-btn.danger:hover){background:#b91c1c;border-color:#b91c1c;color:#fff;}
.tela-gestao-trafego :deep(.gt-massa-btn:disabled){opacity:.65;cursor:default;}
@media (max-width:640px){
  /* No celular a barra vira faixa de ponta a ponta — não pode estourar a tela. */
  .tela-gestao-trafego :deep(.gt-massa-bar){left:12px;right:12px;transform:none;max-width:none;justify-content:space-between;}
}
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
.tela-gestao-trafego :deep(.gt-rec-banner.reduzir .gt-rec-keep){color:var(--orange);}
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
  .tela-gestao-trafego :deep(#gt-painel-regua){padding:12px 14px;}
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
