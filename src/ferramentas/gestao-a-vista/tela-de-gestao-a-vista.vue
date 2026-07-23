<template>
  <!-- Template = HTML de #gestao-vista-screen do legado (legacy/index.html L11896-11939),
       VERBATIM. Mantido o id="gv-watermark"/"gv-bg-anim"/"gv-board"/"gv-ticker"/etc.
       (usados por getElementById no JS imperativo abaixo) + class="tela-gestao-a-vista"
       pro CSS com escopo. Única troca no botão "Voltar": onclick="closeGestaoVista()"
       virou @click="closeGestaoVista" (a função continua existindo — agora ela também
       limpa os timers e navega pelo router). Os demais onclick="gvSelectPeriod('...')"/
       "gvToggleAuto()" ficam como STRING literal (igual ao legado), porque são atributos
       HTML nativos — por isso esse cluster também é exposto em window mais abaixo. -->
  <div id="gestao-vista-screen" class="tela-gestao-a-vista">
    <div id="gv-watermark" aria-hidden="true">Vessel Brasil</div>
    <div id="gv-bg-anim" aria-hidden="true"></div>
    <div class="gv-topbar">
      <div class="gv-topbar-brand" style="display:flex;align-items:center;gap:14px">
        <button class="gv-back" @click="closeGestaoVista"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>Voltar</button>
        <img class="rbv-logo rbv-logo-light" :src="logoClaroUrl" alt="RBV">
        <img class="rbv-logo rbv-logo-dark" :src="logoEscuroUrl" alt="RBV">
        <div style="display:flex;flex-direction:column;gap:2px">
          <span class="gv-perf-tag">Performance de Vendas</span>
          <span class="gv-brand-tag">Vessel Brasil · Gestão à Vista</span>
        </div>
      </div>
      <div class="gv-period-btns" id="gv-period-btns">
        <button class="gv-pbtn active" data-period="today" onclick="gvSelectPeriod('today')"><span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--green);margin-right:5px;animation:pulse 2s infinite;vertical-align:middle;flex-shrink:0;"></span>HOJE</button>
        <button class="gv-pbtn" data-period="1d" onclick="gvSelectPeriod('1d')">1D</button>
        <button class="gv-pbtn" data-period="7d" onclick="gvSelectPeriod('7d')">7D</button>
        <button class="gv-pbtn" data-period="14d" onclick="gvSelectPeriod('14d')">14D</button>
        <button class="gv-pbtn" data-period="30d" onclick="gvSelectPeriod('30d')">30D</button>
        <button class="gv-pbtn" data-period="monthfull" onclick="gvSelectPeriod('monthfull')">MÊS</button>
        <button class="gv-pbtn" data-period="lastmonth" onclick="gvSelectPeriod('lastmonth')">MÊS PASS.</button>
        <button class="gv-pbtn" data-period="sofar" onclick="gvSelectPeriod('sofar')">ATÉ AGORA</button>
        <button class="vs-ac-toggle" id="gv-ac-toggle" onclick="gvToggleAuto()" title="Auto-ciclo de períodos">▶ AUTO</button>
      </div>
      <div class="gv-clock-wrap">
        <span class="live-dot" style="margin-bottom:4px">Tempo Real</span>
        <div class="gv-clock-time" id="gv-clock">--:--:--</div>
        <div class="gv-clock-date" id="gv-date"></div>
        <div class="gv-update-status" id="gv-update-status">—</div>
      </div>
    </div>
    <div class="gv-cf-bar" id="gv-cf-bar" aria-label="Filtro por canal">
      <span class="gv-cf-lbl">Canal</span>
      <div class="gv-cf-chips" id="gv-cf-chips"></div>
    </div>
    <div class="gv-board" id="gv-board">
      <div class="gv-loading-screen">
        <div class="gv-spinner"></div>
        <span class="gv-loading-lbl">Carregando dados</span>
      </div>
    </div>
    <div class="gv-est" id="gv-est">
      <button class="gv-est-head" id="gv-est-toggle" aria-expanded="false">
        <span class="gv-est-caret">▶</span><span class="gv-est-t">Estoque por canal</span>
        <span class="gv-est-sub" id="gv-est-sub">clique para mostrar</span>
      </button>
      <div class="gv-est-body" id="gv-est-body" hidden>
        <div class="gv-est-controls">
          <input class="gv-est-search" id="gv-est-search" placeholder="Buscar SKU ou produto…">
          <select class="gv-est-sel" id="gv-est-status"><option value="todos">Todos</option><option value="baixocrit">Baixo + crítico</option><option value="crit">Só crítico</option></select>
          <select class="gv-est-sel" id="gv-est-sort"><option value="qasc">Estoque ↑</option><option value="qdesc">Estoque ↓</option><option value="sku">SKU</option><option value="nome">Nome</option></select>
          <select class="gv-est-sel" id="gv-est-limit"><option value="10">10</option><option value="20">20</option><option value="50">50</option><option value="100">100</option><option value="all">Todos</option></select>
          <span class="gv-est-count" id="gv-est-count"></span>
        </div>
        <div class="gv-est-cols" id="gv-est-cols"></div>
      </div>
    </div>
    <div class="gv-ticker" id="gv-ticker">
      <span class="gv-ticker-lbl" id="gv-ticker-lbl">Últimos pedidos</span>
      <div class="gv-ticker-sep"></div>
      <div class="gv-ticker-outer"><div class="gv-ticker-inner" id="gv-ticker-inner">—</div></div>
      <span class="gv-refresh-tag" id="gv-refresh-tag">—</span>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { sbClient, SUPABASE_URL, SUPABASE_ANON_KEY } from '../../compartilhado/conectar-no-banco-de-dados.js'
import { hasPermission } from '../../compartilhado/controle-de-login-e-usuario.js'
import { adminToast } from '../../compartilhado/avisos.js'
import { filtrarPedidosPorCanal, depositosVisiveis, prepararEstoque, statusSaldo, DEPOSITOS } from './estoque-gv.js'

const router = useRouter()

let _gvCanaisSel = new Set() // loja.ids selecionadas no filtro por canal; vazio = Todos

const logoClaroUrl = '/midia/LOGOTIPOBRENOPRETO.png'
const logoEscuroUrl = '/midia/LOGOTIPOBRENOBRANCO.png'

// ==========================================================================
// PORTE VERBATIM da Gestão à Vista (legacy/index.html — funções e estado
// espalhados entre L5804-7674, menos openGestaoVista/closeGestaoVista, que
// viraram onMounted/closeGestaoVista(cleanup+router) abaixo).
//
// Dependências externas resolvidas:
//   - sbClient, SUPABASE_URL, SUPABASE_ANON_KEY  → import (conectar-no-banco-de-dados.js)
//   - adminToast                                  → import (avisos.js) — usado só na guarda
//   - hasPermission                                → import (controle-de-login-e-usuario.js)
//   - fmtR, fmtR0, escHtml, _fadeSwap, blingCall, blingPages → COPIADOS abaixo
//     (helpers do legado que a Gestão à Vista usa e que ainda não têm um lugar
//     compartilhado no Vue; ver legacy L3394, L6294, L4851, L5410, L6261, L6275).
//   - setHomeBgTheme('sales') / o toggle de tela via getElementById+display /
//     sessionStorage.setItem('rbv-screen',...) do openGestaoVista/closeGestaoVista
//     originais foram OMITIDOS: são do fundo animado global (#bg-shapes) e da
//     troca de "telas" por display:none do monólito, que não existem mais — quem
//     mostra/esconde a tela agora é o vue-router.
//
// Nada foi reescrito para template reativo — o board e o ticker seguem montados
// via getElementById/createElement/innerHTML, exatamente como a produção atual.
// Por isso todo o cluster de funções GV usadas em onclick="..." (no <template>
// acima e dentro do HTML gerado em runtime) é exposto em window no fim deste
// bloco.
// ==========================================================================

/* ── Helpers copiados do legado (self-contidos) ── */
function fmtR(v){const p=v.toFixed(2).split('.');return 'R$ '+p[0].replace(/\B(?=(\d{3})+(?!\d))/g,'.')+','+p[1];}
function fmtR0(v){return 'R$ '+Math.round(Number(v)).toLocaleString('pt-BR');}
function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function _fadeSwap(el,swapFn){
  el.style.transition='opacity .18s ease';
  el.style.opacity='0';
  setTimeout(()=>{
    swapFn();
    // 80ms buffer: let browser fully paint new DOM before fading in
    setTimeout(()=>{
      el.style.transition='opacity .38s cubic-bezier(.22,1,.36,1)';
      el.style.opacity='1';
      setTimeout(()=>{el.style.transition='';el.style.opacity='';},420);
    },80);
  },190);
}
async function blingCall(endpoint,params){
  const{data:{session}}=await sbClient.auth.getSession();
  if(!session)throw new Error('Não autenticado');
  const r=await fetch(SUPABASE_URL+'/functions/v1/bling-proxy',{
    method:'POST',
    headers:{
      'Authorization':'Bearer '+session.access_token,
      'apikey':SUPABASE_ANON_KEY,
      'Content-Type':'application/json'
    },
    body:JSON.stringify({endpoint,params})
  });
  return r.json();
}
async function blingPages(endpoint,params){
  const all=[];let page=1;
  for(;;){
    let items=[];
    for(let retry=0;retry<3;retry++){
      const resp=await blingCall(endpoint,{...params,pagina:page,limite:100});
      const d=resp.data;
      if(Array.isArray(d)&&d.length>0){items=d;break;}
      if(retry<2)await new Promise(r=>setTimeout(r,700));
    }
    if(!items.length)break;
    all.push(...items);
    if(items.length<100)break;
    page++;
    if(page>10)break;
  }
  return all;
}

/* ── Estado do módulo (legacy/index.html, verbatim) ── */
let _gvSkuVersion=0;
async function _gvBuildSkuSlide(pedidos,pedidosPrev){
  const myVersion=_gvSkuVersion;
  await new Promise(r=>setTimeout(r,500));
  if(myVersion!==_gvSkuVersion)return;
  const skuMap={};
  const newVendIds=new Set();
  const bgMappings=[];
  const bgVendRows=[];
  let newVendorFound=false;
  let batchCount=0;

  // Processa pedidos do período atual: SKU + vendor mapping
  for(const p of pedidos){
    if(myVersion!==_gvSkuVersion)return;
    try{
      const resp=await blingCall(`pedidos/vendas/${p.id}`,{});
      const det=resp.data;
      const vid=det?.vendedor?.id;
      if(vid){
        const isNew=!window._gvPedidoVendorMap[p.id];
        window._gvPedidoVendorMap[p.id]=vid;
        bgMappings.push({pedido_id:parseInt(p.id),vendor_id:vid,pedido_data:p.data?.slice(0,10)||null,qtd_itens:det?.itens?.length||1});
        if(!window._gvVendedoresCache[vid])newVendIds.add(vid);
        if(isNew)newVendorFound=true;
      }
      const dt=p.data?new Date(p.data):null;
      for(const it of(det?.itens||[])){
        const sku=it.codigo||it.produto?.codigo||'—';
        const nome=it.descricao||it.produto?.descricao||it.produto?.nome||'—';
        const preco=parseFloat(it.valor||it.valorUnidade||0);
        const qty=parseFloat(it.quantidade||1);
        if(!skuMap[sku])skuMap[sku]={sku:escHtml(sku),nome:escHtml(nome),preco,qty:0,lastDate:null};
        skuMap[sku].qty+=qty;
        if(dt&&(!skuMap[sku].lastDate||dt>skuMap[sku].lastDate))skuMap[sku].lastDate=dt;
      }
    }catch(e){}
    batchCount++;
    if(batchCount%10===0){
      if(newVendorFound){_gvUpdateVendRanking();newVendorFound=false;}
      if(bgMappings.length){const snap=[...bgMappings];bgMappings.length=0;sbClient.from('bling_pedido_vendedor').upsert(snap,{onConflict:'pedido_id'}).then(null,()=>{});}
      // Progressive SKU ticker update — updates the slide as data arrives instead of waiting until the end
      const _intTop=Object.values(skuMap).sort((a,b)=>b.qty-a.qty).slice(0,10);
      if(_intTop.length&&window._gvTickerSlides){
        const _intItems=_intTop.map((s,i)=>{const nm=s.nome.length>40?s.nome.slice(0,40)+'…':s.nome;const dt=s.lastDate?`${String(s.lastDate.getDate()).padStart(2,'0')}/${String(s.lastDate.getMonth()+1).padStart(2,'0')}/${s.lastDate.getFullYear().toString().slice(2)}`:'';return `<span class="gv-ticker-item"><strong>#${i+1} ${s.sku}</strong> · ${nm} · ${fmtR(s.preco)} · <span style="opacity:.7">${Math.round(s.qty)} un.${dt?` · última: ${dt}`:''}</span></span>`;});
        window._gvTickerSlides[1]={label:'Itens mais vendidos',items:_intItems};
        // Não re-renderiza — ticker usa os dados na próxima troca de slide naturalmente
      }
    }
  }

  // Processa pedidos anteriores: só vendor mapping (sem SKU)
  for(const p of(pedidosPrev||[])){
    if(myVersion!==_gvSkuVersion)return;
    if(window._gvPedidoVendorMap[p.id])continue;
    try{
      const resp=await blingCall(`pedidos/vendas/${p.id}`,{});
      const vid=resp.data?.vendedor?.id;
      if(vid){
        window._gvPedidoVendorMap[p.id]=vid;
        bgMappings.push({pedido_id:parseInt(p.id),vendor_id:vid,pedido_data:p.data?.slice(0,10)||null,qtd_itens:resp.data?.itens?.length||1});
        if(!window._gvVendedoresCache[vid])newVendIds.add(vid);
        newVendorFound=true;
      }
    }catch(e){}
    batchCount++;
    if(batchCount%10===0){
      if(newVendorFound){_gvUpdateVendRanking();newVendorFound=false;}
      if(bgMappings.length){const snap=[...bgMappings];bgMappings.length=0;sbClient.from('bling_pedido_vendedor').upsert(snap,{onConflict:'pedido_id'}).then(null,()=>{});}
    }
  }

  if(myVersion!==_gvSkuVersion)return;
  // Busca nomes dos novos vendedores
  for(const vid of newVendIds){
    if(myVersion!==_gvSkuVersion)return;
    if(window._gvVendedoresCache[vid])continue;
    try{
      const resp=await blingCall(`vendedores/${vid}`,{});
      const v=resp.data;
      if(v){
        const nome=v.contato?.nome||v.nome||v.nomeFantasia||'';
        window._gvVendedoresCache[vid]={nome,loja:''};
        bgVendRows.push({vendor_id:vid,nome,updated_at:new Date().toISOString()});
        newVendorFound=true;
      }
    }catch(e){}
  }
  if(bgMappings.length)sbClient.from('bling_pedido_vendedor').upsert(bgMappings,{onConflict:'pedido_id'}).then(null,()=>{});
  if(bgVendRows.length)sbClient.from('bling_vendedores').upsert(bgVendRows,{onConflict:'vendor_id'}).then(null,()=>{});
  if(newVendorFound||newVendIds.size)_gvUpdateVendRanking();

  const topSkus=Object.values(skuMap).sort((a,b)=>b.qty-a.qty).slice(0,10);
  if(!topSkus.length)return;
  const items=topSkus.map((s,i)=>{
    const nome=s.nome.length>40?s.nome.slice(0,40)+'…':s.nome;
    const dtStr=s.lastDate?`${String(s.lastDate.getDate()).padStart(2,'0')}/${String(s.lastDate.getMonth()+1).padStart(2,'0')}/${s.lastDate.getFullYear().toString().slice(2)}`:'';
    return `<span class="gv-ticker-item"><strong>#${i+1} ${s.sku}</strong> · ${nome} · ${fmtR(s.preco)} · <span style="opacity:.7">${Math.round(s.qty)} un.${dtStr?` · última: ${dtStr}`:''}</span></span>`;
  });
  if(window._gvTickerSlides){
    window._gvTickerSlides[1]={label:'Itens mais vendidos',items};
    // Não re-renderiza — ticker usa os dados na próxima troca de slide naturalmente
  }
}
function _gvUpdateVendRanking(){
  const ctx=window._gvRenderCtx;
  if(!ctx)return;
  const el=document.getElementById('gv-rank-inner-v');
  if(!el)return;
  const pedidos=ctx.pedidosView||ctx.pedidos; // filtrado (vista atual do board), não o cheio de ctx.pedidos
  const {pedidosPrev,canais,diPrev,dfPrev}=ctx;
  const vm=window._gvVendedoresCache||{};
  const pm=window._gvPedidoVendorMap||{};
  const porVendObj={};
  pedidos.forEach(p=>{
    const vId=pm[p.id]||p.vendedor?.id;
    const vNome=(vm[vId]?.nome||'Sem vendedor').split(' ').slice(0,2).join(' ');
    const canal=ctx.canais?.[p.loja?.id]||'';
    const key=vId||vNome;
    if(!porVendObj[key])porVendObj[key]={nm:vNome,total:0,cnt:0,canalCnt:{}};
    porVendObj[key].total+=parseFloat(p.total||0);
    porVendObj[key].cnt++;
    if(canal)porVendObj[key].canalCnt[canal]=(porVendObj[key].canalCnt[canal]||0)+1;
  });
  Object.values(porVendObj).forEach(vd=>{const e=Object.entries(vd.canalCnt);vd.canal=e.sort((a,b)=>b[1]-a[1])[0]?.[0]||'';});
  const vendsArr=Object.values(porVendObj).sort((a,b)=>b.total-a.total);
  const porVendPrev={};
  (pedidosPrev||[]).forEach(p=>{
    const vId=pm[p.id]||p.vendedor?.id;
    const vNome=(vm[vId]?.nome||'Sem vendedor').split(' ').slice(0,2).join(' ');
    const key=vId||vNome;
    porVendPrev[key]=(porVendPrev[key]||0)+parseFloat(p.total||0);
  });
  const maxVend=vendsArr[0]?.total||1;
  function numCls(i){return i===0?'gold':i===1?'silver':i===2?'bronze':'rest';}
  function fmtR0(v){return 'R$ '+Math.round(Number(v)).toLocaleString('pt-BR');}
  function fmtK(v){const a=Math.abs(v);return a>=1e6?(v/1e6).toFixed(1)+'M':a>=1e3?(v/1e3).toFixed(0)+'k':String(Math.round(v));}
  el.innerHTML=vendsArr.slice(0,12).map((vd,i)=>{
    const key=Object.keys(porVendObj).find(k=>porVendObj[k]===vd)||vd.nm;
    const vPrev=porVendPrev[key]||0;
    const vDelta=vPrev>0?Math.round((vd.total-vPrev)/vPrev*100):null;
    return `<div class="gv-rank-entry">
      <span class="gv-rank-num ${numCls(i)}">${i+1}</span>
      <div class="gv-rank-body">
        <div class="gv-rank-row">
          <span class="gv-rank-nm">${escHtml(vd.nm)}${vd.canal?` <span style="opacity:.55;font-size:.85em">· ${escHtml(vd.canal)}</span>`:''}</span>
          <div style="display:flex;align-items:center;gap:3px;flex-shrink:0">
            ${vDelta!=null?`<span class="gv-rank-delta ${vDelta>=0?'up':'dn'}">${vDelta>=0?'↑':'↓'}${Math.abs(vDelta)}%</span>`:''}
            <span class="gv-rank-v">${fmtR0(vd.total)}</span>
          </div>
        </div>
        <div class="gv-rank-bar"><div class="gv-rank-bar-fill ${numCls(i)}" style="width:${Math.round(vd.total/maxVend*100)}%"></div></div>
        <div class="gv-rank-hint">${vd.cnt} pedido${vd.cnt!==1?'s':''}</div>
      </div>
    </div>`;
  }).join('');
}
function _gvFitCanalGrid(){
  const isTV=document.body.classList.contains('dev-tv');
  // Auto-ajuste dos velocímetros roda em TODO layout de painel fixo (TV, desktop e
  // notebook >1024, que é 100vh/overflow:hidden). Antes só rodava em dev-tv/dev-desktop,
  // então no notebook normal os gauges NÃO se ajustavam e estouravam o card. No layout
  // responsivo empilhado (≤1024, a tela vira scrollável) o ajuste não se aplica.
  if(window.innerWidth<=1024)return;
  const panel=document.querySelector('#gestao-vista-screen .gv-canal-panel');
  const scroll=document.getElementById('gv-canal-scroll');
  const inner=document.getElementById('gv-canal-inner');
  const grid=scroll?.querySelector('.gv-canal-grid');
  if(!panel||!scroll||!inner||!grid)return;
  const n=grid.children.length;
  if(!n)return;
  const W=scroll.clientWidth;
  const H_card=panel.clientHeight;
  if(!W||!H_card)return;
  const H_max=Math.floor(H_card*0.95); // usa quase toda a altura do painel (folga mínima) —
  // 0.85 deixava os velocímetros pequenos com muito espaço vazio embaixo. 0.95 aumenta o
  // tamanho limite (gauges maiores, preenchem o card) sem estourar.
  const gap=isTV?20:10;
  const labelH=isTV?46:20;
  const vbAR=1.33;
  // Encontra menor nº de colunas cujo totalH cabe em H_max
  let bestCols=n;
  for(let c=1;c<=n;c++){
    const itemW=(W-(c-1)*gap)/c;
    const rows=Math.ceil(n/c);
    const totalH=rows*(labelH+itemW*vbAR)+(rows-1)*gap;
    if(totalH<=H_max){bestCols=c;break;}
  }
  // Fallback: se nem 1 linha cabe, limita largura de cada item
  const itemW_n=(W-(n-1)*gap)/n;
  if(labelH+itemW_n*vbAR>H_max){
    const maxW=Math.max(60,Math.floor((H_max-labelH)/vbAR));
    grid.style.gridTemplateColumns=`repeat(${n},${maxW}px)`;
    grid.style.justifyContent='center';
  }else{
    grid.style.gridTemplateColumns=`repeat(${bestCols},1fr)`;
    grid.style.justifyContent='';
  }
}
function _gvFitKpiText(){
  document.querySelectorAll('#gestao-vista-screen .gv-main-kpi-v').forEach(el=>{
    el.style.fontSize='';
    const cell=el.closest('.gv-main-kpi-item');
    if(!cell)return;
    let size=parseFloat(getComputedStyle(el).fontSize);
    while(el.scrollWidth>cell.clientWidth&&size>9){
      size-=0.5;
      el.style.fontSize=size+'px';
    }
  });
}
// Impede QUALQUER <text> dos velocímetros de estourar a largura do medidor. A estimativa
// no HTML (fitAttr) é um primeiro palpite; aqui a gente MEDE de verdade (getComputedTextLength,
// já com o SVG no DOM) e, se o texto passar de 92% da largura do viewBox, espreme com
// textLength. Cobre TODOS os textos (valor grande, vendido, e o rótulo de baixo line4 que
// antes escapava), independente de fonte/tamanho. Roda após render e no resize.
function _gvFitGaugeValues(){
  document.querySelectorAll('#gestao-vista-screen svg').forEach(svg=>{
    const vb=svg.viewBox&&svg.viewBox.baseVal;
    if(!vb||!vb.width)return;
    const maxW=vb.width*0.92; // 8% de folga total
    svg.querySelectorAll('text').forEach(t=>{
      // tira um ajuste anterior pra medir a largura NATURAL, senão getComputedTextLength
      // devolveria o próprio textLength já aplicado.
      t.removeAttribute('textLength');
      t.removeAttribute('lengthAdjust');
      let len;
      try{ len=t.getComputedTextLength(); }catch(e){ return; }
      if(len>maxW){
        t.setAttribute('textLength',maxW.toFixed(0));
        t.setAttribute('lengthAdjust','spacingAndGlyphs');
      }
    });
  });
}
// Handler único do resize: refaz o grid E o ajuste dos valores (precisa ser função nomeada
// pra dar removeEventListener sem vazar listener).
function _gvFitReflow(){ _gvFitCanalGrid(); _gvFitGaugeValues(); }
const _GV_QUOTES=[
  {q:'A imaginação é mais importante que o conhecimento.',a:'Albert Einstein'},
  {q:'A vida é o que acontece enquanto você está ocupado fazendo outros planos.',a:'John Lennon'},
  {q:'Seja a mudança que você quer ver no mundo.',a:'Mahatma Gandhi'},
  {q:'O sucesso é ir de fracasso em fracasso sem perder o entusiasmo.',a:'Winston Churchill'},
  {q:'Aqueles que são loucos o suficiente para achar que podem mudar o mundo são os que o fazem.',a:'Steve Jobs'},
  {q:'Não é a mais forte das espécies que sobrevive, mas a mais adaptável.',a:'Charles Darwin'},
  {q:'A mente que se abre a uma nova ideia jamais voltará ao seu tamanho original.',a:'Albert Einstein'},
  {q:'Você nunca cruzará o oceano se tiver medo de perder a costa de vista.',a:'Cristóvão Colombo'},
  {q:'O único modo de fazer um excelente trabalho é amar o que você faz.',a:'Steve Jobs'},
  {q:'Errar é humano, mas perseverar no erro é diabólico.',a:'Sêneca'},
  {q:'O tempo é o recurso mais escasso. Sem geri-lo, você não poderá gerir nada.',a:'Peter Drucker'},
  {q:'A criatividade é a inteligência se divertindo.',a:'Albert Einstein'},
  {q:'Não espere por oportunidades extraordinárias. Agarre ocasiões comuns e as torne grandiosas.',a:'Orison Swett Marden'},
  {q:'Se você quer ir rápido, vá sozinho. Se quer ir longe, vá acompanhado.',a:'Provérbio africano'},
  {q:'A excelência não é um ato, mas um hábito.',a:'Aristóteles'},
  {q:'Toda grande jornada começa com um único passo.',a:'Lao Tsé'},
  {q:'O homem que move montanhas começa carregando pequenas pedras.',a:'Confúcio'},
  {q:'Aquilo que não te mata te fortalece.',a:'Friedrich Nietzsche'},
  {q:'Eu não falhei. Apenas descobri 10.000 maneiras que não funcionam.',a:'Thomas Edison'},
  {q:'O segredo do sucesso é começar.',a:'Mark Twain'},
  {q:'O diabo mora nos detalhes.',a:'Breno Vale'},
  {q:'Quem é bom em dar desculpa, não é bom em mais nada.',a:'Breno Vale'},
];
let _gvLastQuoteIdx=-1;
function _gvPickQuote(){
  let idx;
  do{idx=Math.floor(Math.random()*_GV_QUOTES.length);}while(idx===_gvLastQuoteIdx&&_GV_QUOTES.length>1);
  _gvLastQuoteIdx=idx;
  return _GV_QUOTES[idx];
}
function _gvRenderTickerSlide(idx){
  const slide=(window._gvTickerSlides||[])[idx];
  if(!slide)return;
  const lbl=document.getElementById('gv-ticker-lbl');
  const inner=document.getElementById('gv-ticker-inner');
  // Slide de citações: sorteia uma frase nova a cada exibição
  if(slide.isQuotes){const qt=_gvPickQuote();slide.items=[`<span class="gv-ticker-item"><em>"${qt.q}"</em> — <strong>${qt.a}</strong></span>`];}
  if(lbl)lbl.textContent=slide.label;
  if(inner){
    if(window._gvTickerTimer){clearTimeout(window._gvTickerTimer);window._gvTickerTimer=null;}
    inner.classList.remove('animate');
    inner.style.removeProperty('--ticker-travel');
    inner.innerHTML=slide.items.length>0?slide.items.join('<span class="gv-ticker-dot"></span>'):'—';
    if(slide.items.length>0){
      requestAnimationFrame(()=>{
        const outer=inner.parentElement;
        const travel=Math.max(0,inner.scrollWidth-(outer?outer.clientWidth:0));
        const dur=travel>0?Math.max(12,Math.round(travel/80)):12;
        inner.style.setProperty('--ticker-travel',`-${travel}px`);
        inner.style.setProperty('--ticker-dur',dur+'s');
        inner.classList.add('animate');
        // Timer baseado na duração calculada — independente de CSS animation (que pode ser none em telas pequenas)
        window._gvTickerTimer=setTimeout(_gvNextTickerSlide,dur*2*1000+1500);
      });
    }else{
      window._gvTickerTimer=setTimeout(_gvNextTickerSlide,3000);
    }
  }
}
function _gvNextTickerSlide(){
  const ticker=document.getElementById('gv-ticker');
  if(!ticker)return;
  window._gvTickerIdx=((window._gvTickerIdx||0)+1)%((window._gvTickerSlides||[{},{}]).length);
  ticker.style.transition='opacity .18s ease';
  ticker.style.opacity='0';
  setTimeout(()=>{
    _gvRenderTickerSlide(window._gvTickerIdx);
    ticker.style.transition='opacity .25s ease';
    ticker.style.opacity='1';
  },200);
}

// Equivalente ao closeGestaoVista() do legado (que fazia display:none + showHome()
// da sales-menu-screen). Continua limpando os mesmos timers; a troca de tela agora
// é feita pelo router. Também roda no onUnmounted (sem o router.push de novo),
// para garantir que nada fique rodando em segundo plano se o componente for
// destruído por outro caminho que não seja este botão.
function _gvStopAllTimers(){
  gvAutoStop();
  if(window._gvTickerTimer){clearTimeout(window._gvTickerTimer);window._gvTickerTimer=null;}
  if(_gvStatusTimer){clearInterval(_gvStatusTimer);_gvStatusTimer=null;}
  if(window._gvTimer){clearInterval(window._gvTimer);window._gvTimer=null;}
  if(window._gvClockTimer){clearInterval(window._gvClockTimer);window._gvClockTimer=null;}
  window.removeEventListener('resize',_gvFitReflow);
}
function closeGestaoVista(){
  _gvStopAllTimers();
  router.push({ name: 'vendas' });
}

const GV_AC_PERIODS=['sofar','today','1d','7d','14d','30d','monthfull'];
const GV_AC_DURATION=60; // segundos por período
let _gvAcIdx=0,_gvAcTimer=null;

function gvSelectPeriod(p){
  // Sincroniza índice do ciclo com o período escolhido manualmente
  const idx=GV_AC_PERIODS.indexOf(p);
  if(idx>=0)_gvAcIdx=idx;
  loadGestaoVistaData(p);
}
function gvAutoStart(){
  if(_gvAcTimer)return;
  try{localStorage.setItem('gv-autocycle','1');}catch(e){}
  const btn=document.getElementById('gv-ac-toggle');
  if(btn)btn.classList.add('running');
  const scheduleNext=()=>{
    _gvAcTimer=setTimeout(async()=>{
      if(!_gvAcTimer)return;
      _gvAcIdx=(_gvAcIdx+1)%GV_AC_PERIODS.length;
      await loadGestaoVistaData(GV_AC_PERIODS[_gvAcIdx]);
      if(_gvAcTimer)scheduleNext(); // só reagenda após o load terminar
    },GV_AC_DURATION*1000);
  };
  scheduleNext();
}
function gvAutoStop(){
  clearTimeout(_gvAcTimer);_gvAcTimer=null;
  try{localStorage.setItem('gv-autocycle','0');}catch(e){}
  const btn=document.getElementById('gv-ac-toggle');
  if(btn)btn.classList.remove('running');
}
function gvToggleAuto(){if(_gvAcTimer)gvAutoStop();else gvAutoStart();}

function startGVClock(){
  const tEl=document.getElementById('gv-clock'),dEl=document.getElementById('gv-date');
  if(!tEl)return;
  const tick=()=>{
    const now=new Date();
    tEl.textContent=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0')+':'+String(now.getSeconds()).padStart(2,'0');
    if(dEl){const ds=now.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'});dEl.textContent=ds.toUpperCase();}
  };
  tick();if(window._gvClockTimer)clearInterval(window._gvClockTimer);
  window._gvClockTimer=setInterval(tick,1000);
}

let _gvLastLoadTime=null;
let _gvStatusTimer=null;
function updateGvUpdateStatus(){
  const el=document.getElementById('gv-update-status');
  if(!el)return;
  if(!_gvLastLoadTime){el.textContent='—';return;}
  const pad=n=>String(n).padStart(2,'0');
  const fmt=d=>`${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const next=new Date(_gvLastLoadTime.getTime()+5*60*1000);
  el.textContent=`ULT. ${fmt(_gvLastLoadTime)} · PRÓX. ${fmt(next)}`;
}

let _gvCurrentPeriod='today';
let _gvLoadId=0; // cancela fetches anteriores imediatamente ao trocar período
async function loadGestaoVistaData(period){
  const myLoad=++_gvLoadId; // incrementa ANTES de qualquer await para cancelar SKU slide
  ++_gvSkuVersion;           // aborta _gvBuildSkuSlide em andamento
  if(period)_gvCurrentPeriod=period;
  else period=_gvCurrentPeriod;
  document.querySelectorAll('.gv-pbtn').forEach(b=>b.classList.toggle('active',b.dataset.period===period));
  const board=document.getElementById('gv-board');
  const now=new Date();
  // Datas calculadas no fuso horário BRT para evitar deslocamento UTC vs Bling API
  const brt=new Date(now.toLocaleString('en-US',{timeZone:'America/Sao_Paulo'}));
  const y=brt.getFullYear(),m=brt.getMonth()+1;
  const pad2=n=>String(n).padStart(2,'0');
  const brtAdd=days=>{const d=new Date(brt);d.setDate(d.getDate()+days);return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;};
  const brtToday=`${y}-${pad2(m)}-${pad2(brt.getDate())}`;
  let diasMes=new Date(y,m,0).getDate();
  let diaAtual=brt.getDate();
  let metaY=y,metaM=m;
  let di,df;
  if(period==='today'){di=df=brtToday;}
  else if(period==='1d'){di=df=brtAdd(-1);}
  else if(period==='7d'){di=brtAdd(-7);df=brtToday;}
  else if(period==='14d'){di=brtAdd(-14);df=brtToday;}
  else if(period==='30d'){di=brtAdd(-30);df=brtToday;}
  else if(period==='monthfull'){di=`${y}-${pad2(m)}-01`;df=brtToday;}
  else if(period==='sofar'){di=`${y}-${pad2(m)}-01`;df=brtToday;}
  else if(period==='lastmonth'){const s=new Date(y,m-2,1),e=new Date(y,m-1,0);di=`${s.getFullYear()}-${pad2(s.getMonth()+1)}-${pad2(s.getDate())}`;df=`${e.getFullYear()}-${pad2(e.getMonth()+1)}-${pad2(e.getDate())}`;metaY=e.getFullYear();metaM=e.getMonth()+1;diasMes=e.getDate();diaAtual=e.getDate();}
  else{di=`${y}-${pad2(m)}-01`;df=brtToday;}
  function subMes(s){const d=new Date(s+'T12:00:00');const od=d.getDate();d.setDate(1);d.setMonth(d.getMonth()-1);d.setDate(Math.min(od,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));return d.toISOString().slice(0,10);}
  let diPrev=subMes(di),dfPrev=subMes(df);
  if(period==='monthfull'||period==='sofar'){const _pme=new Date(y,m-1,0);dfPrev=`${_pme.getFullYear()}-${pad2(_pme.getMonth()+1)}-${pad2(_pme.getDate())}`; }
  try{
    // Bling: chamadas SEQUENCIAIS para evitar rate limit (3 simultâneas causavam paginação incompleta)
    const pedidos=await blingPages('pedidos/vendas',{dataInicial:di,dataFinal:df,'idsSituacoes[]':9});
    if(myLoad!==_gvLoadId)return;
    const pedidosPrev=await blingPages('pedidos/vendas',{dataInicial:diPrev,dataFinal:dfPrev,'idsSituacoes[]':9}).catch(()=>[]);
    if(myLoad!==_gvLoadId)return;

    // Supabase: pode rodar em paralelo (API diferente)
    const[canais,metasRows]=await Promise.all([
      sbClient.from('bling_lojas').select('loja_id,nome').then(r=>{const mp={};(r.data||[]).forEach(l=>mp[l.loja_id]=l.nome);return mp;}).catch(()=>({})),
      sbClient.from('bling_metas').select('loja_id,meta_valor,daily_goals').eq('year',metaY).eq('month',metaM).then(r=>r.data||[]).catch(()=>[])
    ]);

    const metasMap={};const dailyGoalsMap={};
    metasRows.forEach(r=>{metasMap[r.loja_id]=r.meta_valor;if(r.daily_goals)dailyGoalsMap[r.loja_id]=r.daily_goals;});

    // Vendedores: carrega do Supabase (instantâneo) + descobre mapeamentos faltantes via detalhe Bling
    if(!window._gvVendedoresCache)window._gvVendedoresCache={};
    if(!window._gvPedidoVendorMap)window._gvPedidoVendorMap={};
    const allIds=[...new Set([...pedidos,...pedidosPrev].map(p=>p.id).filter(Boolean))];
    const [vendRows,pedVRows]=await Promise.all([
      sbClient.from('bling_vendedores').select('vendor_id,nome').then(r=>r.data||[]).catch(()=>[]),
      allIds.length?sbClient.from('bling_pedido_vendedor').select('pedido_id,vendor_id').in('pedido_id',allIds.slice(0,500)).then(r=>r.data||[]).catch(()=>[]):Promise.resolve([])
    ]);
    vendRows.forEach(r=>{window._gvVendedoresCache[r.vendor_id]={nome:r.nome,loja:''};});
    pedVRows.forEach(r=>{window._gvPedidoVendorMap[r.pedido_id]=r.vendor_id;});
    if(myLoad!==_gvLoadId)return;
    // Renderiza imediatamente com o cache do Supabase — fetches pendentes vão para background
    const vendedoresMap={};
    window._gvRenderCtx={
      pedidos,pedidosPrev,canais,diPrev,dfPrev,
      // demais args de renderGestaoVista (Task 2 — filtro por canal), guardados
      // pra _gvAplicaFiltro repassar sem re-fetch nem recomputar Bling/Supabase:
      metasMap,hoje:df,diasMes,diaAtual,di,period,vendedoresMap,dailyGoalsMap,actualToday:brtToday,
      // pedidosView = conjunto REALMENTE renderizado no board agora (igual a
      // `pedidos` até que um filtro de canal seja aplicado); _gvUpdateVendRanking
      // usa isso, não `pedidos` (que fica sempre CHEIO pra _gvMontaChips listar
      // todos os canais) — senão o ranking de vendedores reaparece sem filtro.
      pedidosView:pedidos,
    };
    if(myLoad!==_gvLoadId)return; // troca de período enquanto carregava — descarta silenciosamente
    const totalPrev=pedidosPrev.reduce((s,p)=>s+parseFloat(p.total||0),0);
    _fadeSwap(board,()=>{
      renderGestaoVista(pedidos,canais,metasMap,df,diasMes,diaAtual,di,period,totalPrev,pedidosPrev.length,pedidosPrev,diPrev,dfPrev,vendedoresMap,dailyGoalsMap,brtToday);
      _gvMontaChips();
      // se algum canal já estava selecionado (ex.: trocou de período com filtro ativo),
      // reaplica pra não deixar os chips marcados divergindo do board (que acabou de
      // renderizar SEM filtro acima).
      if(_gvCanaisSel.size>0)_gvAplicaFiltro();
    });
    if(window._gvTimer)clearInterval(window._gvTimer);
    window._gvTimer=setInterval(()=>loadGestaoVistaData(_gvCurrentPeriod),5*60*1000);
    _gvLastLoadTime=new Date();
    updateGvUpdateStatus();
    if(!_gvStatusTimer)_gvStatusTimer=setInterval(updateGvUpdateStatus,60000);
    const brtNow=new Date(now.toLocaleString('en-US',{timeZone:'America/Sao_Paulo'}));
    document.getElementById('gv-refresh-tag').textContent='PRÓX. '+String(brtNow.getHours()).padStart(2,'0')+':'+String((brtNow.getMinutes()+5)%60).padStart(2,'0');
  }catch(e){
    if(myLoad!==_gvLoadId)return;
    board.innerHTML=`<div class="gv-loading-full">Erro ao carregar — ${escHtml(e.message)}</div>`;
  }
}

// ── Filtro por canal (Task 2) ────────────────────────────────────────────
// Monta a barra de chips [Todos] + um por canal CADASTRADO (ctx.canais, vindo
// de bling_lojas) — TODOS os canais aparecem, mesmo sem pedido no período,
// pra o filtro sempre oferecer o conjunto completo (não só quem vendeu).
function _gvMontaChips(){
  const ctx=window._gvRenderCtx; if(!ctx)return;
  const ids=Object.keys(ctx.canais||{}).map(id=>parseInt(id,10)).filter(id=>!isNaN(id))
    .sort((a,b)=>String(ctx.canais[a]||'').localeCompare(String(ctx.canais[b]||''),'pt-BR'));
  const chips=document.getElementById('gv-cf-chips'); if(!chips)return;
  const mk=(id,nome)=>`<button class="gv-cf-chip${(id===null?_gvCanaisSel.size===0:_gvCanaisSel.has(id))?' active':''}" data-id="${id===null?'':id}">${escHtml(nome)}</button>`;
  chips.innerHTML=mk(null,'Todos')+ids.map(id=>mk(id,ctx.canais[id]||('Canal #'+String(id).slice(-4)))).join('');
  chips.querySelectorAll('.gv-cf-chip').forEach(b=>{
    b.onclick=()=>{
      if(!b.dataset.id){_gvCanaisSel.clear();}
      else{
        const id=parseInt(b.dataset.id,10);
        if(_gvCanaisSel.has(id))_gvCanaisSel.delete(id);else _gvCanaisSel.add(id);
      }
      _gvAplicaFiltro();
    };
  });
}
// Refiltra pedidos/pedidosPrev pela UNIÃO dos canais selecionados e re-renderiza
// o board com os MESMOS args guardados no load (metasMap/vendedoresMap/etc não
// são recomputados — só totalPrev/cntPrev, que são somas baratas e precisam
// refletir os canais filtrados pra a comparação com o período anterior fazer sentido).
function _gvAplicaFiltro(){
  const ctx=window._gvRenderCtx; if(!ctx)return;
  const ids=[..._gvCanaisSel];
  const peds=filtrarPedidosPorCanal(ctx.pedidos,ids);
  const pedsPrev=filtrarPedidosPorCanal(ctx.pedidosPrev,ids);
  const totalPrevF=pedsPrev.reduce((s,p)=>s+parseFloat(p.total||0),0);
  ctx.pedidosView=peds; // board atual = filtrado; _gvUpdateVendRanking lê daqui, não de ctx.pedidos (cheio)
  renderGestaoVista(peds,ctx.canais,ctx.metasMap,ctx.hoje,ctx.diasMes,ctx.diaAtual,ctx.di,ctx.period,totalPrevF,pedsPrev.length,pedsPrev,ctx.diPrev,ctx.dfPrev,ctx.vendedoresMap,ctx.dailyGoalsMap,ctx.actualToday);
  _gvMontaChips();           // reflete o estado ativo
  if(typeof _gvRenderEstoque==='function')_gvRenderEstoque();
}

// ── Estoque por canal (Task 3) ───────────────────────────────────────────
// Seção colapsável (fechada por padrão) que lê gc_estoque_item uma vez (cache)
// e mostra uma coluna por depósito visível ao(s) canal(is) selecionado(s) no
// filtro de canal (_gvCanaisSel), com busca/status/ordenação/limite próprios.
let _gvEstoqueCache=null; // [{deposito_id,sku,produto,saldo}]
async function _gvCarregaEstoque(){
  if(_gvEstoqueCache)return _gvEstoqueCache;
  const ids=DEPOSITOS.map(d=>d.id);
  const size=1000, rows=[];
  try{
    for(let from=0;;from+=size){
      const { data, error }=await sbClient.from('gc_estoque_item').select('deposito_id,sku,produto,saldo').in('deposito_id',ids).range(from,from+size-1);
      if(error)throw error;
      rows.push(...(data||[]));
      if(!data||data.length<size)break;
    }
    _gvEstoqueCache=rows;
  }catch(e){
    _gvEstoqueCache=[];
  }
  return _gvEstoqueCache;
}
async function _gvRenderEstoque(){
  const body=document.getElementById('gv-est-body');
  if(!body||body.hidden)return; // fechada — não faz trabalho à toa
  const itens=await _gvCarregaEstoque();
  const ctx=window._gvRenderCtx;
  const canaisNomes=[..._gvCanaisSel].map(id=>ctx&&ctx.canais&&ctx.canais[id]).filter(Boolean);
  const deps=depositosVisiveis(canaisNomes);
  const opts={
    busca:document.getElementById('gv-est-search').value,
    status:document.getElementById('gv-est-status').value,
    sort:document.getElementById('gv-est-sort').value,
  };
  const limitSel=document.getElementById('gv-est-limit').value;
  const lim=limitSel==='all'?'all':parseInt(limitSel,10);
  let mostrado=0,filtrado=0;
  document.getElementById('gv-est-cols').innerHTML=deps.map(dep=>{
    const itensDep=itens.filter(it=>it.deposito_id===dep.id);
    const { rows, full }=prepararEstoque(itensDep,{...opts,limit:lim});
    mostrado+=rows.length; filtrado+=full;
    const tot=rows.reduce((a,b)=>a+(Number(b.saldo)||0),0);
    const more=(lim!=='all'&&full>rows.length)?`<div class="gv-est-more">+ ${full-rows.length} ocultos · ${rows.length} de ${full}</div>`:'';
    const linhas=rows.length?rows.map(r=>{
      const s=statusSaldo(r.saldo);
      const lbl=s==='crit'?'Crítico':s==='low'?'Baixo':'OK';
      return `<div class="gv-est-row"><div class="gv-est-info"><span class="gv-est-sku">${escHtml(r.sku)}</span><span class="gv-est-nm">${escHtml(r.produto||'')}</span></div><span class="gv-est-pill gv-est-pill-${s}">${lbl}</span><span class="gv-est-q">${r.saldo}</span></div>`;
    }).join(''):'<div class="gv-est-empty">Nada com esse filtro.</div>';
    return `<div class="gv-est-col"><div class="gv-est-colh"><span>${escHtml(dep.nome)}${dep.pulmao?' · pulmão':''}</span><span class="gv-est-tot">${tot} un.</span></div>${linhas}${more}</div>`;
  }).join('');
  document.getElementById('gv-est-count').textContent=`mostrando ${mostrado} de ${filtrado} itens · ${deps.length} depósito(s)`;
}

function initGvBgAnim(){
  const el=document.getElementById('gv-bg-anim');
  if(!el||el.children.length)return;
  const ns='http://www.w3.org/2000/svg';
  const W=1920,H=900;
  const svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio','xMidYMid slice');
  const rng=seed=>{let s=seed;return()=>{s=(s*16807)%2147483647;return(s-1)/2147483646;};};
  const cfgs=[
    {seed:7,  col:'#4f7cff',yBase:680,yRange:220,dur:18,delay:0,  nPts:18},
    {seed:23, col:'#22c55e',yBase:720,yRange:200,dur:26,delay:4,  nPts:20},
    {seed:41, col:'#4f7cff',yBase:600,yRange:250,dur:34,delay:9,  nPts:16},
    {seed:59, col:'#f59e0b',yBase:750,yRange:180,dur:22,delay:6,  nPts:22},
    {seed:77, col:'#22c55e',yBase:640,yRange:240,dur:40,delay:13, nPts:15},
    {seed:97, col:'#a78bfa',yBase:700,yRange:200,dur:30,delay:2,  nPts:19},
    {seed:113,col:'#4f7cff',yBase:800,yRange:160,dur:50,delay:16, nPts:14},
  ];
  cfgs.forEach((cfg,li)=>{
    const r=rng(cfg.seed);
    const step=W/(cfg.nPts-1);
    let y=cfg.yBase;
    const pts=[];
    for(let i=0;i<cfg.nPts;i++){
      y+=r()*70-25;
      y=Math.max(cfg.yBase-cfg.yRange,Math.min(cfg.yBase+cfg.yRange*0.4,y));
      pts.push(`${(i*step).toFixed(0)},${y.toFixed(0)}`);
    }
    const g=document.createElementNS(ns,'g');
    g.style.animation=`gvBgRise ${cfg.dur}s linear ${cfg.delay}s infinite alternate`;
    const area=document.createElementNS(ns,'polygon');
    area.setAttribute('points',[...pts,`${W},${H}`,`0,${H}`].join(' '));
    area.setAttribute('fill',cfg.col);
    area.setAttribute('opacity','0.12');
    const line=document.createElementNS(ns,'polyline');
    line.setAttribute('points',pts.join(' '));
    line.setAttribute('stroke',cfg.col);
    line.setAttribute('stroke-width','2');
    line.setAttribute('fill','none');
    line.setAttribute('opacity','0.7');
    g.appendChild(area);g.appendChild(line);svg.appendChild(g);
  });
  el.appendChild(svg);
}

function renderGestaoVista(pedidos,canais,metasMap,hoje,diasMes,diaAtual,di,period,totalPrev,cntPrev,pedidosPrev,diPrev,dfPrev,vendedoresMap,dailyGoalsMap,actualToday){
  vendedoresMap=vendedoresMap||{};dailyGoalsMap=dailyGoalsMap||{};
  const todayStr=actualToday||hoje;
  const total=pedidos.reduce((s,p)=>s+parseFloat(p.total||0),0);
  const totalHoje=period==='1d'?total:pedidos.filter(p=>p.data?.slice(0,10)===todayStr).reduce((s,p)=>s+parseFloat(p.total||0),0);
  const diasTot=di?Math.ceil((new Date(hoje)-new Date(di))/864e5)+1:diaAtual;
  const diasTotMeta=period==='monthfull'?diasMes:diasTot;
  const diasElapsed=period==='monthfull'?diaAtual:diasTot;
  const proj=diasElapsed>0?(total/diasElapsed)*diasMes:0;
  const metaTotal=(metasMap[0]!=null?Number(metasMap[0]):null)||Object.values(metasMap).reduce((s,v)=>s+(Number(v)||0),0)||null;
  // Usa metas diárias quando disponíveis (período dentro do mesmo mês)
  const _calcMetaPeriodo=(lojaId,fallback)=>{
    // lojaId=0 (geral): sempre agrega daily goals de todos os canais individuais
    let dg=lojaId===0?null:dailyGoalsMap[lojaId];
    if(lojaId===0){const mg={};Object.entries(dailyGoalsMap).forEach(([,g])=>{if(g)Object.entries(g).forEach(([d,v])=>mg[d]=(mg[d]||0)+Number(v||0));});if(Object.keys(mg).length>0)dg=mg;}
    if(dg&&di&&di.slice(0,7)===hoje.slice(0,7)){
      const d1=parseInt(di.slice(8)),d2=period==='monthfull'?diasMes:parseInt(hoje.slice(8));
      let s=0;for(let d=d1;d<=d2;d++)s+=Number(dg[String(d)]||0);
      if(s>0)return s;
    }
    return fallback;
  };
  const metaPeriodo=metaTotal?_calcMetaPeriodo(0,metaTotal/diasMes*diasTotMeta):null;
  const pct=metaPeriodo?Math.round(total/metaPeriodo*100):null;
  const deltaPct=(totalPrev&&totalPrev>0)?Math.round((total-totalPrev)/totalPrev*100):null;
  const desvioMeta=metaPeriodo!=null?total-metaPeriodo:null;
  const ticket=pedidos.length?total/pedidos.length:0;
  const ticketPrev=cntPrev?totalPrev/cntPrev:0;
  const deltaTicket=(ticketPrev>0)?Math.round((ticket-ticketPrev)/ticketPrev*100):null;
  const totalHojePrev=(pedidosPrev||[]).filter(p=>p.data?.slice(0,10)===dfPrev).reduce((s,p)=>s+parseFloat(p.total||0),0);
  const deltaHoje=totalHojePrev>0?Math.round((totalHoje-totalHojePrev)/totalHojePrev*100):null;
  const projPrev=diasTot>0?totalPrev/diasTot*diasMes:0;
  const deltaProj=projPrev>0?Math.round((proj-projPrev)/projPrev*100):null;
  const deltaCnt=cntPrev>0?Math.round((pedidos.length-cntPrev)/cntPrev*100):null;

  // Per canal — current + prev
  const porCanal={},cntCanal={};
  pedidos.forEach(p=>{const id=p.loja?.id||0;porCanal[id]=(porCanal[id]||0)+parseFloat(p.total||0);cntCanal[id]=(cntCanal[id]||0)+1;});
  const porCanalPrev={};
  (pedidosPrev||[]).forEach(p=>{const id=p.loja?.id||0;porCanalPrev[id]=(porCanalPrev[id]||0)+parseFloat(p.total||0);});
  // Canais em EXIBIÇÃO (velocímetros + rankings): os SELECIONADOS no filtro
  // (_gvCanaisSel, estado de módulo do filtro por canal) ou, sem seleção
  // ("Todos"), a união de TODOS os canais cadastrados (`canais`, bling_lojas)
  // com os que aparecem em `porCanal` (cobre id fora do cadastro, ex.: 0/"Outros").
  // Canal sem venda no período entra com v=0/cnt=0 — R$ 0,00, não some da tela.
  const universo=[...new Set([...Object.keys(canais),...Object.keys(porCanal)])]
    .map(id=>parseInt(id,10)).filter(id=>!isNaN(id));
  const displayIds=(_gvCanaisSel&&_gvCanaisSel.size)?[..._gvCanaisSel]:universo;
  const canaisArr=displayIds.map(id=>({id,nm:canais[id]||(id?'Canal #'+String(id).slice(-4):'Outros'),v:porCanal[id]||0,cnt:cntCanal[id]||0})).sort((a,b)=>b.v-a.v);
  const maxC=canaisArr[0]?.v||1;

  // Per vendedor — usa mapa pedido→vendedor preenchido em background pelo _gvBuildSkuSlide
  const _vm=window._gvVendedoresCache||{};
  const _pm=window._gvPedidoVendorMap||{};
  const porVendObj={};
  pedidos.forEach(p=>{
    const vId=_pm[p.id]||p.vendedor?.id;
    const vNome=(_vm[vId]?.nome||'Sem vendedor').split(' ').slice(0,2).join(' ');
    const canal=canais[p.loja?.id]||'';
    const key=vId||vNome;
    if(!porVendObj[key])porVendObj[key]={nm:vNome,total:0,cnt:0,canalCnt:{}};
    porVendObj[key].total+=parseFloat(p.total||0);
    porVendObj[key].cnt++;
    if(canal)porVendObj[key].canalCnt[canal]=(porVendObj[key].canalCnt[canal]||0)+1;
  });
  Object.values(porVendObj).forEach(vd=>{const e=Object.entries(vd.canalCnt);vd.canal=e.sort((a,b)=>b[1]-a[1])[0]?.[0]||'';});
  const vendsArr=Object.values(porVendObj).sort((a,b)=>b.total-a.total);
  const porVendPrev={};
  (pedidosPrev||[]).forEach(p=>{
    const vId=_pm[p.id]||p.vendedor?.id;
    const vNome=(_vm[vId]?.nome||'Sem vendedor').split(' ').slice(0,2).join(' ');
    const key=vId||vNome;
    porVendPrev[key]=(porVendPrev[key]||0)+parseFloat(p.total||0);
  });
  const maxV=vendsArr[0]?.total||1;

  const isDark=document.documentElement.dataset.theme==='dark';
  const trackClr=isDark?'rgba(255,255,255,.08)':'rgba(0,0,0,.08)';
  const numCls=i=>i===0?'gold':i===1?'silver':i===2?'bronze':'rest';
  function pctHex(p){return p===null?'#4f7cff':p>=100?'#22c55e':p>=80?'#eab308':'#f43f5e';}
  function fmtK(v){const a=Math.abs(v);return a>=1e6?(v/1e6).toFixed(1)+'M':a>=1e3?(v/1e3).toFixed(0)+'k':String(Math.round(v));}
  function fmtPrevLbl(dip,dfp){if(!dip||!dfp)return 'ant.';const mons=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];const s=dip.slice(8),e=dfp.slice(8),mo=mons[parseInt(dip.slice(5,7))-1];const moe=mons[parseInt(dfp.slice(5,7))-1];if(dip===dfp)return s+'/'+mo;if(dip.slice(0,7)===dfp.slice(0,7))return s+'-'+e+'/'+mo;return s+'/'+mo+'→'+e+'/'+moe;}
  const prevLbl=fmtPrevLbl(diPrev,dfPrev);
  const todayPrevLbl=fmtPrevLbl(dfPrev,dfPrev);  // sempre só o dia equivalente do mês anterior

  // Encolhe o texto do medidor SÓ quando ele passaria da largura (senão estoura o card).
  // A Sora/Mono é mais larga que a Oswald antiga, então valores grandes de "vendido"
  // vazavam. textLength força o texto a caber em maxW; lengthAdjust espreme letra+espaço.
  // Só aplica quando a largura estimada excede maxW — texto curto fica no tamanho natural.
  function fitAttr(txt,fs,maxW,mono){
    const charW=fs*(mono?0.62:0.56); // largura média por caractere
    const estW=String(txt==null?'':txt).length*charW;
    return estW>maxW?` textLength="${maxW}" lengthAdjust="spacingAndGlyphs"`:'';
  }
  function bigGauge(p,hexColor,uid,line1,line2,line3,line4parts){
    const R=78,cx=100,cy=98;
    const C=2*Math.PI*R,sweep=240/360*C,gap=C-sweep;
    const fill=p!==null?Math.min(Math.max(p,0),100)/100*sweep:0;
    const rot=150;
    const parts=Array.isArray(line4parts)?line4parts:(line4parts?[{text:line4parts,color:'var(--muted)'}]:[]);
    const line4svg=parts.length?`<text x="100" y="162" text-anchor="middle" font-family="Sora,sans-serif" font-size="10.5" font-weight="600">${parts.map((pt,i)=>`<tspan fill="${pt.color}">${i>0?' · ':''}${pt.text}</tspan>`).join('')}</text>`:'';
    const isGoal=p!==null&&p>=100;
    const gid=`bgliq_${uid}`;
    const nid=`bgneon_${uid}`;
    const neonFilter=isGoal?`drop-shadow(0 0 6px ${hexColor}) drop-shadow(0 0 20px ${hexColor}99)`:`drop-shadow(0 0 8px ${hexColor}88)`;
    return `<svg viewBox="0 0 200 190" style="width:100%;height:100%;overflow:visible;display:block">
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="200" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${hexColor}"/>
          <stop offset="44%" stop-color="${hexColor}"/>
          <stop offset="50%" stop-color="white" stop-opacity="0.38"/>
          <stop offset="56%" stop-color="${hexColor}"/>
          <stop offset="100%" stop-color="${hexColor}"/>
          <animate attributeName="x1" values="-200;400" dur="3.5s" repeatCount="indefinite"/>
          <animate attributeName="x2" values="0;600" dur="3.5s" repeatCount="indefinite"/>
        </linearGradient>
      </defs>
      <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${trackClr}" stroke-width="13"
        stroke-dasharray="${sweep.toFixed(1)} ${gap.toFixed(1)}" stroke-linecap="round"
        transform="rotate(${rot} ${cx} ${cy})"/>
      <circle id="${uid}" cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="url(#${gid})" stroke-width="13"
        stroke-dasharray="0.01 ${C.toFixed(1)}" stroke-linecap="round"
        transform="rotate(${rot} ${cx} ${cy})"
        data-fill="${fill.toFixed(1)}" data-c="${C.toFixed(1)}"
        style="transition:stroke-dasharray 2s cubic-bezier(.4,0,.2,1);filter:${neonFilter}"
        ${isGoal?`class="gauge-neon-arc"`:''}/>
      <text x="100" y="86" text-anchor="middle" font-family="IBM Plex Mono,ui-monospace,monospace" font-size="42" font-weight="600" fill="${hexColor}"${fitAttr(line1,42,184,true)}>${line1}</text>
      <text x="100" y="109" text-anchor="middle" font-family="Sora,sans-serif" font-size="10" fill="var(--muted)" letter-spacing="2"${fitAttr(line2,10,184,false)}>${line2}</text>
      <text x="100" y="138" text-anchor="middle" font-family="IBM Plex Mono,ui-monospace,monospace" font-size="22" font-weight="500" fill="var(--text)"${fitAttr(line3,22,184,true)}>${line3}</text>
      ${line4svg}
    </svg>`;
  }
  function smGauge(p,hexColor,uid,topText,vendidoStr,metaStr,desvioStr,desvioCol,canalNm,deltaStr,deltaCol){
    const R=34,cx=50,cy=44;
    const C=2*Math.PI*R,sweep=240/360*C,gap=C-sweep;
    const fill=p!==null?Math.min(Math.max(p,0),100)/100*sweep:0;
    const rot=150;
    // As linhas abaixo do arco EMPILHAM: cada uma só ocupa espaço se existir.
    //
    // Antes cada linha tinha um y fixo (86, 99, 111, 123, 135) e o viewBox tinha
    // altura fixa. Quando o canal não tem meta, as três do meio (vendido, meta,
    // desvio) não renderizam — mas o delta continuava cravado lá embaixo e a altura
    // continuava reservada, deixando um vão enorme entre o valor e a última linha.
    // Era o caso mais comum na tela, porque a maioria dos canais não tem meta.
    //
    // O `vao` de cada linha é a distância até a PRÓXIMA. Os valores preservam o
    // espaçamento original de quando todas as 5 aparecem — só o caso incompleto muda.
    const linhas=[
      vendidoStr&&{t:vendidoStr,tam:15, peso:500,fonte:'IBM Plex Mono,ui-monospace,monospace',      cor:'var(--text)',            vao:13},
      metaStr   &&{t:metaStr,   tam:9,  peso:400,fonte:'Sora,sans-serif',cor:'var(--muted)',          vao:12},
      desvioStr &&{t:desvioStr, tam:7.5,peso:700,fonte:'Sora,sans-serif',cor:desvioCol||'var(--muted)',vao:12},
      canalNm   &&{t:canalNm,   tam:5.4,peso:400,fonte:'Sora,sans-serif',cor:'var(--muted)',          vao:12},
      deltaStr  &&{t:deltaStr,  tam:7.5,peso:700,fonte:'Sora,sans-serif',cor:deltaCol||'var(--muted)', vao:0},
    ].filter(Boolean);
    let _y=86; // primeira linha logo abaixo do arco (que termina em y≈78)
    const linhasSvg=linhas.map(l=>{
      const mono=/Mono/.test(l.fonte);
      const svg=`<text x="50" y="${_y}" text-anchor="middle" font-family="${l.fonte}" font-size="${l.tam}" font-weight="${l.peso}" fill="${l.cor}"${fitAttr(l.t,l.tam,92,mono)}>${l.t}</text>`;
      _y+=l.vao;
      return svg;
    }).join('');
    // Altura sob medida: sobra só o respiro da última linha. Sem linha nenhuma, 62
    // (só o arco), como era antes.
    const vbH=linhas.length?_y+10:62;
    const isGoal=p!==null&&p>=100;
    const gid=`sgliq_${uid}`;
    const neonFilter=isGoal?`drop-shadow(0 0 4px ${hexColor}) drop-shadow(0 0 12px ${hexColor}99)`:`drop-shadow(0 0 4px ${hexColor}88)`;
    return `<svg viewBox="0 0 100 ${vbH}" style="width:100%;height:auto;overflow:visible;display:block">
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${hexColor}"/>
          <stop offset="44%" stop-color="${hexColor}"/>
          <stop offset="50%" stop-color="white" stop-opacity="0.38"/>
          <stop offset="56%" stop-color="${hexColor}"/>
          <stop offset="100%" stop-color="${hexColor}"/>
          <animate attributeName="x1" values="-100;200" dur="3.5s" repeatCount="indefinite"/>
          <animate attributeName="x2" values="0;300" dur="3.5s" repeatCount="indefinite"/>
        </linearGradient>
      </defs>
      <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${trackClr}" stroke-width="7"
        stroke-dasharray="${sweep.toFixed(1)} ${gap.toFixed(1)}" stroke-linecap="round"
        transform="rotate(${rot} ${cx} ${cy})"/>
      <circle id="${uid}" cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="url(#${gid})" stroke-width="7"
        stroke-dasharray="0.01 ${C.toFixed(1)}" stroke-linecap="round"
        transform="rotate(${rot} ${cx} ${cy})"
        data-fill="${fill.toFixed(1)}" data-c="${C.toFixed(1)}"
        style="transition:stroke-dasharray 2s cubic-bezier(.4,0,.2,1);filter:${neonFilter}"
        ${isGoal?`class="gauge-neon-arc"`:''}/>
      <text x="50" y="51" text-anchor="middle" font-family="IBM Plex Mono,ui-monospace,monospace" font-size="22" font-weight="600" fill="${hexColor}">${topText}</text>
      ${linhasSvg}
    </svg>`;
  }

  // Main gauge lines
  const mainHex=pctHex(pct);
  const mainLine1=pct!==null?pct+'%':'–';
  const mainLine2=metaPeriodo!=null?'META '+fmtR0(metaPeriodo):'SEM META';
  const mainLine3=fmtR0(total);
  // 4th line: desvio R$ + delta % vs anterior
  const desvioStr=desvioMeta!=null?(desvioMeta>=0?'↑ R$':'↓ R$')+fmtK(Math.abs(desvioMeta))+' da meta':null;
  const deltaStr=deltaPct!=null?(deltaPct>=0?'↑':'↓')+Math.abs(deltaPct)+'% vs '+prevLbl:null;
  const line4parts=[];
  if(desvioStr)line4parts.push({text:desvioStr,color:desvioMeta>=0?'#22c55e':'#f43f5e'});
  if(deltaStr)line4parts.push({text:deltaStr,color:deltaPct>=0?'#22c55e':'#f43f5e'});

  // ── SMALL GAUGES (per canal) ── um gauge por canal em EXIBIÇÃO (canaisArr já
  // é o universo completo — ver comentário acima), incluindo os com R$ 0,00.
  const smGaugesHtml=canaisArr.map((c,i)=>{
    const hasMeta=!!metasMap[c.id];
    const cMetaP=hasMeta?_calcMetaPeriodo(c.id,metasMap[c.id]/diasMes*diasTotMeta):null;
    const cPct=cMetaP?Math.round(c.v/cMetaP*100):null;
    const cHex=hasMeta?pctHex(cPct):'#4f7cff';
    const topText=hasMeta&&cPct!==null?cPct+'%':fmtR0(c.v);
    const cPrev=porCanalPrev[c.id]||0;
    const cDelta=cPrev>0?Math.round((c.v-cPrev)/cPrev*100):null;
    const cDesvio=cMetaP!=null?c.v-cMetaP:null;
    const vendStr=hasMeta?fmtR0(c.v):null;
    const metaTxt=cMetaP?'meta '+fmtR0(cMetaP):null;
    const desvTxt=cDesvio!=null?(cDesvio>=0?'↑ R$':'↓ R$')+fmtK(Math.abs(cDesvio))+' da meta':null;
    const desvCol=cDesvio!=null?(cDesvio>=0?'#22c55e':'#f43f5e'):null;
    const cDeltaTxt=cDelta!=null?(cDelta>=0?'↑':'↓')+Math.abs(cDelta)+'% vs '+prevLbl:null;
    const cDeltaCol=cDelta!=null?(cDelta>=0?'#22c55e':'#f43f5e'):null;
    return `<div class="gv-sm-item">
      <div class="gv-sm-item-lbl">${escHtml(c.nm)}</div>
      ${smGauge(hasMeta?cPct:null,cHex,'gv-g-c'+i,topText,vendStr,metaTxt,desvTxt,desvCol,'',cDeltaTxt,cDeltaCol)}
    </div>`;
  }).join('');

  // ── RANKINGS ──
  const canaisRank=canaisArr.map((c,i)=>{
    const cPrev=porCanalPrev[c.id]||0;
    const cDelta=cPrev>0?Math.round((c.v-cPrev)/cPrev*100):null;
    const cMetaP=metasMap[c.id]?metasMap[c.id]/diasMes*diasTotMeta:null;
    const cDesvio=cMetaP!=null?c.v-cMetaP:null;
    return `<div class="gv-rank-entry">
      <span class="gv-rank-num ${numCls(i)}">${i+1}</span>
      <div class="gv-rank-body">
        <div class="gv-rank-row">
          <span class="gv-rank-nm">${escHtml(c.nm)}</span>
          <div style="display:flex;align-items:center;gap:3px;flex-shrink:0">
            ${cDelta!=null?`<span class="gv-rank-delta ${cDelta>=0?'up':'dn'}">${cDelta>=0?'↑':'↓'}${Math.abs(cDelta)}%</span>`:''}
            <span class="gv-rank-v">${fmtR0(c.v)}</span>
          </div>
        </div>
        <div class="gv-rank-bar"><div class="gv-rank-bar-fill ${numCls(i)}" data-w="${Math.round(c.v/maxC*100)}%" style="width:0"></div></div>
        <div class="gv-rank-hint">${c.cnt} pedido${c.cnt!==1?'s':''}${cDesvio!=null?' · <span style="color:'+( cDesvio>=0?'#22c55e':'#f43f5e')+'">'+(cDesvio>=0?'+':'')+fmtK(cDesvio)+' meta</span>':''}</div>
      </div>
    </div>`;
  }).join('');

  const maxVend=vendsArr[0]?.total||1;
  const vendsRank=vendsArr.slice(0,12).map((vd,i)=>{
    const key=Object.keys(porVendObj).find(k=>porVendObj[k]===vd)||vd.nm;
    const vPrev=porVendPrev[key]||0;
    const vDelta=vPrev>0?Math.round((vd.total-vPrev)/vPrev*100):null;
    return `<div class="gv-rank-entry">
      <span class="gv-rank-num ${numCls(i)}">${i+1}</span>
      <div class="gv-rank-body">
        <div class="gv-rank-row">
          <span class="gv-rank-nm">${escHtml(vd.nm)}${vd.canal?` <span style="opacity:.55;font-size:.85em">· ${escHtml(vd.canal)}</span>`:''}</span>
          <div style="display:flex;align-items:center;gap:3px;flex-shrink:0">
            ${vDelta!=null?`<span class="gv-rank-delta ${vDelta>=0?'up':'dn'}">${vDelta>=0?'↑':'↓'}${Math.abs(vDelta)}%</span>`:''}
            <span class="gv-rank-v">${fmtR0(vd.total)}</span>
          </div>
        </div>
        <div class="gv-rank-bar"><div class="gv-rank-bar-fill ${numCls(i)}" data-w="${Math.round(vd.total/maxVend*100)}%" style="width:0"></div></div>
        <div class="gv-rank-hint">${vd.cnt} pedido${vd.cnt!==1?'s':''}</div>
      </div>
    </div>`;
  }).join('');

  document.getElementById('gv-board').innerHTML=`
    <div class="gv-left">
      <div class="gv-kpi-period">${period&&period!=='today'&&di?di.split('-').reverse().join('/')+' → '+(period==='monthfull'?`${String(diasMes).padStart(2,'0')}/${hoje.slice(5,7)}/${hoje.slice(0,4)}`:hoje.split('-').reverse().join('/')):'Dia '+diaAtual+' de '+diasMes+' · '+hoje.split('-').reverse().join('/')}</div>
      <div class="gv-col-grid-label gv-main-chart-title" style="margin-bottom:2px;margin-top:4px;font-size:11.2px;font-weight:700;color:var(--text)">Vendas Geral</div>
      <div class="gv-gauge-wrap">
        <div class="gv-gauge-inner">
          ${bigGauge(pct,mainHex,'gv-g-main',mainLine1,mainLine2,mainLine3,line4parts)}
        </div>
      </div>
      <div class="gv-main-kpi">
        <div class="gv-main-kpi-item">
          <div class="gv-main-kpi-v">${fmtR0(totalHoje)}</div>
          <div class="gv-main-kpi-l">${period==='1d'?'Ontem':'Hoje'}</div>
          ${deltaHoje!=null?`<div class="gv-main-kpi-d" style="color:${deltaHoje>=0?'#22c55e':'#f43f5e'}">${deltaHoje>=0?'↑':'↓'}${Math.abs(deltaHoje)}% vs ${todayPrevLbl}</div>`:''}
        </div>
        <div class="gv-main-kpi-item">
          <div class="gv-main-kpi-v">${fmtR0(proj)}</div>
          <div class="gv-main-kpi-l">Projeção</div>
          ${deltaProj!=null?`<div class="gv-main-kpi-d" style="color:${deltaProj>=0?'#22c55e':'#f43f5e'}">${deltaProj>=0?'↑':'↓'}${Math.abs(deltaProj)}% vs ${prevLbl}</div>`:''}
        </div>
        <div class="gv-main-kpi-item">
          <div class="gv-main-kpi-v">${pedidos.length}</div>
          <div class="gv-main-kpi-l">Pedidos</div>
          ${deltaCnt!=null?`<div class="gv-main-kpi-d" style="color:${deltaCnt>=0?'#22c55e':'#f43f5e'}">${deltaCnt>=0?'↑':'↓'}${Math.abs(deltaCnt)}% vs ${prevLbl}</div>`:''}
        </div>
        <div class="gv-main-kpi-item">
          <div class="gv-main-kpi-v">${fmtR(ticket)}</div>
          <div class="gv-main-kpi-l">Ticket</div>
          ${deltaTicket!=null?`<div class="gv-main-kpi-d" style="color:${deltaTicket>=0?'#22c55e':'#f43f5e'}">${deltaTicket>=0?'↑':'↓'}${Math.abs(deltaTicket)}% vs ${prevLbl}</div>`:''}
        </div>
        ${desvioMeta!=null?`<div class="gv-main-kpi-item"><div class="gv-main-kpi-v" style="color:${desvioMeta>=0?'#22c55e':'#f43f5e'}">${desvioMeta>=0?'+':''}${fmtR0(desvioMeta)}</div><div class="gv-main-kpi-l">Desvio Meta</div></div>`:''}
        ${deltaPct!=null?`<div class="gv-main-kpi-item"><div class="gv-main-kpi-v" style="color:${deltaPct>=0?'#22c55e':'#f43f5e'}">${deltaPct>=0?'+':''}${deltaPct}%</div><div class="gv-main-kpi-l">Var. Período</div></div>`:''}
      </div>
    </div>
    <div class="gv-right">
      <div class="gv-canal-panel">
        <div class="gv-col-grid-label">Venda por canal</div>
        <div class="gv-canal-scroll" id="gv-canal-scroll">
          <div class="gv-canal-scroll-inner" id="gv-canal-inner">
            <div class="gv-canal-grid">${smGaugesHtml}</div>
          </div>
        </div>
      </div>
      <div class="gv-rankings">
        <div class="gv-rank-panel">
          <div class="gv-rank-col-hdr">Ranking por Canal</div>
          <div class="gv-rank-scroll" id="gv-rank-scroll-c"><div class="gv-rank-scroll-inner" id="gv-rank-inner-c">${canaisRank}</div></div>
        </div>
        <div class="gv-rank-panel">
          <div class="gv-rank-col-hdr">Ranking por Vendedor</div>
          <div class="gv-rank-scroll" id="gv-rank-scroll-v"><div class="gv-rank-scroll-inner" id="gv-rank-inner-v">${vendsRank}</div></div>
        </div>
      </div>
    </div>
  `;
  // Ajusta grid de canais antes do board aparecer (board ainda opacity:0 — sem flash)
  requestAnimationFrame(()=>{_gvFitCanalGrid();_gvFitKpiText();_gvFitGaugeValues();});

  // Ticker — slide 1: últimos pedidos
  const recent=[...pedidos].sort((a,b)=>new Date(b.data||0)-new Date(a.data||0)).slice(0,10);
  const tickItemsPedidos=recent.map(p=>{
    const num=p.numero?`#${p.numero}`:'';
    const canal=escHtml(canais[p.loja?.id]||'—');
    const val=fmtR(parseFloat(p.total||0));
    // Vendedor: usa cache de nomes + mapeamento pedido→vendedor populados em background
    const _vc=window._gvVendedoresCache||{};
    const _pm=window._gvPedidoVendorMap||{};
    const vId=_pm[p.id]||p.vendedor?.id;
    const vend=escHtml((_vc[vId]?.nome||p.vendedor?.nome||'—').split(' ').slice(0,2).join(' '));
    const nItens=Math.round((p.itens||[]).reduce((s,i)=>s+(parseFloat(i.quantidade)||1),0));
    const itensStr=nItens>0?`${nItens} ${nItens===1?'item':'itens'}`:'';
    return `<span class="gv-ticker-item">${num?`<strong>${num}</strong> · `:''}${canal} · ${val} · ${vend}${itensStr?` · ${itensStr}`:''}</span>`;
  });

  // Inicializa slides apenas na primeira carga — mudanças de período não reiniciam o ticker
  const tickerAlreadyRunning=window._gvTickerSlides!==null;
  if(!tickerAlreadyRunning){
    window._gvTickerSlides=[
      {label:'Últimos pedidos',items:tickItemsPedidos},
      {label:'Itens mais vendidos',items:[]},
      {label:'Citação',items:[],isQuotes:true}
    ];
    window._gvTickerIdx=0;
    _gvRenderTickerSlide(0);
  }else{
    window._gvTickerSlides[0]={label:'Últimos pedidos',items:tickItemsPedidos};
  }

  // Busca itens de cada pedido em background (lista não inclui itens, precisa de detalhe individual)
  _gvBuildSkuSlide([...pedidos].sort((a,b)=>new Date(b.data||0)-new Date(a.data||0)),pedidosPrev);

  setTimeout(()=>{
    document.querySelectorAll('#gestao-vista-screen [data-w]').forEach(el=>el.style.width=el.dataset.w);
    document.querySelectorAll('[data-fill][data-c]').forEach(el=>{
      const fill=parseFloat(el.dataset.fill),c=parseFloat(el.dataset.c);
      el.style.strokeDasharray=`${fill.toFixed(1)} ${(c-fill).toFixed(1)}`;
    });
    ['c','v'].forEach(id=>{
      const wrap=document.getElementById('gv-rank-scroll-'+id);
      const inner=document.getElementById('gv-rank-inner-'+id);
      if(!wrap||!inner)return;
      const overflow=inner.scrollHeight-wrap.clientHeight;
      if(overflow>16){
        const dur=Math.max(12,overflow/18);
        inner.style.setProperty('--gv-scroll-h',`-${overflow}px`);
        inner.style.setProperty('--gv-scroll-dur',`${dur}s`);
        inner.classList.add('scrolling');
      }
    });
    // Fit canal grid to available height (desktop/TV only)
    _gvFitCanalGrid();
    // Auto-fit KPI values font size
    _gvFitKpiText();
    // Impede o valor dos velocímetros de estourar (medição real)
    _gvFitGaugeValues();
  },300);
  window.removeEventListener('resize',_gvFitReflow);
  window.addEventListener('resize',_gvFitReflow,{passive:true});
}

// Liga o toggle (abre/fecha) e os 4 controles da seção de estoque. Chamado uma
// vez no onMounted — os elementos já existem no template (não são recriados
// por innerHTML como o board/ticker).
function _gvInitEstoqueUI(){
  const toggle=document.getElementById('gv-est-toggle');
  if(!toggle)return;
  toggle.onclick=()=>{
    const b=document.getElementById('gv-est-body');
    b.hidden=!b.hidden;
    document.getElementById('gv-est').classList.toggle('open',!b.hidden);
    document.querySelector('.tela-gestao-a-vista')?.classList.toggle('is-est-open',!b.hidden);
    toggle.setAttribute('aria-expanded',String(!b.hidden));
    document.getElementById('gv-est-sub').textContent=b.hidden?'clique para mostrar':'';
    _gvRenderEstoque();
  };
  ['gv-est-search','gv-est-status','gv-est-sort','gv-est-limit'].forEach(id=>{
    document.getElementById(id).addEventListener('input',_gvRenderEstoque);
  });
}

Object.assign(window, {
  gvSelectPeriod, gvToggleAuto, gvAutoStart, gvAutoStop, closeGestaoVista,
  _gvBuildSkuSlide, _gvUpdateVendRanking, _gvFitCanalGrid, _gvFitKpiText, _gvPickQuote,
  _gvRenderTickerSlide, _gvNextTickerSlide, startGVClock, updateGvUpdateStatus,
  loadGestaoVistaData, initGvBgAnim, renderGestaoVista,
})

// Equivalente ao openGestaoVista() do legado, menos o toggle de tela por display
// (o router faz) e o setHomeBgTheme('sales') (fundo animado global, ainda não
// portado para o Vue).
onMounted(() => {
  if (!hasPermission('module:sales:gestao-vista')) {
    adminToast('Sem acesso', false)
    router.push({ name: 'vendas' })
    return
  }
  startGVClock()
  initGvBgAnim()
  window._gvTickerIdx = null
  window._gvTickerSlides = null
  window._gvVendedoresCache = {}
  window._gvPedidoVendorMap = {}
  window._gvRenderCtx = null
  _gvCanaisSel = new Set()
  _gvEstoqueCache = null
  _gvInitEstoqueUI()
  if (window._gvTickerTimer) { clearTimeout(window._gvTickerTimer); window._gvTickerTimer = null }
  if (_gvStatusTimer) { clearInterval(_gvStatusTimer); _gvStatusTimer = null }
  _gvLastLoadTime = null
  updateGvUpdateStatus()
  _gvAcIdx = 0 // começa no ATÉ AGORA (índice 0 do ciclo)
  _gvCurrentPeriod = 'sofar'
  loadGestaoVistaData('sofar')
  if (localStorage.getItem('gv-autocycle') !== '0') gvAutoStart() // respeita o desligar do usuário
})

// CRÍTICO: limpa TODOS os timers/intervals que a Gestão à Vista inicia, para não
// deixar nada rodando em segundo plano depois que o usuário sai da tela (o
// closeGestaoVista() cobre o caminho do botão "Voltar"; isto cobre qualquer
// outra forma de sair da rota, ex.: navegação direto pela URL).
onUnmounted(() => {
  _gvStopAllTimers()
})
</script>

<style scoped>
/* CSS "peeled" (movido, não copiado) de src/estilos/estilos-globais.css — as
   regras do bloco "GESTÃO À VISTA — TV BOARD v2" (legacy L1992-2162) + os
   overrides responsivos espalhados (legacy L625-767) + as keyframes usadas
   (gvRankUp, gvSpin, gvTickerBF, gvBgRise, gaugeShimmer, gaugeNeonPulse) foram
   removidas de lá e movidas para cá, igual ao que foi feito com #acessos-screen
   em tela-de-acessos.vue. #gestao-vista-screen vira .tela-gestao-a-vista (sem
   display:none). Como o board e o ticker são 100% montados via innerHTML
   (renderGestaoVista/_gvRenderTickerSlide), todo descendente usa :deep()
   (mesmo padrão de tela-de-banco.vue e tela-de-acessos.vue).

   NÃO PORTADO (fora do escopo desta tela, dependem de recursos ainda não
   migrados para o Vue): o botão flutuante global (#global-user-btn) e o
   padding-right de 44px/66px que ele empurrava em .gv-clock-wrap (legacy
   L2216-2219) — sem o botão flutuante, esse respiro ficaria sobrando; quando
   #global-user-btn for portado, adicionar esse padding de volta aqui. Também
   não portados os 3 seletores do @media(max-width:480px) do topbar de Redes
   Sociais (legacy L210-211/222) que também miravam .gv-perf-tag/.gv-brand-tag/
   .gv-back de raspão — o bloco dedicado da Gestão à Vista (≤480px, abaixo) já
   cobre esses mesmos elementos com valores praticamente iguais. */
.tela-gestao-a-vista{height:100vh;max-height:100vh;display:flex;flex-direction:column;background:var(--bg);color:var(--text);overflow:hidden;position:relative;z-index:1;}
/* Task 4: quando a seção de estoque (gv-est) abre, o conteúdo pode passar da
   viewport — deixa a tela crescer e rolar em vez de cortar. Classe alternada
   no toggle de _gvInitEstoqueUI. Não mexe no telão fechado nem no ≤1024px
   (que já é overflow-y:auto por conta própria). */
.tela-gestao-a-vista.is-est-open{height:auto;min-height:100vh;max-height:none;overflow-y:auto;}
.tela-gestao-a-vista :deep(#gv-watermark){position:absolute;bottom:100px;right:32px;font-family:var(--fonte-principal);font-size:73px;font-weight:700;letter-spacing:8px;text-transform:uppercase;color:var(--text);opacity:.18;pointer-events:none;user-select:none;z-index:1;line-height:1;}
.tela-gestao-a-vista :deep(.gv-topbar){display:flex;align-items:center;justify-content:space-between;padding:7px 28px;border-bottom:1px solid var(--border);background:var(--surface);position:sticky;top:0;z-index:10;}
.tela-gestao-a-vista :deep(.gv-back){display:flex;align-items:center;gap:4px;font-family:var(--fonte-principal);font-size:10px;font-weight:600;color:var(--accent);cursor:pointer;background:none;border:none;padding:0;transition:opacity .15s;letter-spacing:.3px;text-transform:uppercase;}
.tela-gestao-a-vista :deep(.gv-back:hover){opacity:.75;}
.tela-gestao-a-vista :deep(.gv-brand-tag){font-family:var(--fonte-principal);font-size:10px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:var(--text);opacity:.6;line-height:1;}
.tela-gestao-a-vista :deep(.gv-perf-tag){font-family:var(--fonte-principal);font-size:13.5px;font-weight:700;letter-spacing:6px;text-transform:uppercase;color:var(--text);opacity:1;line-height:1.2;}
.tela-gestao-a-vista :deep(.gv-clock-wrap){text-align:right;}
.tela-gestao-a-vista :deep(.gv-clock-time){font-family:var(--fonte-dados);font-size:28px;font-weight:400;letter-spacing:3px;color:var(--text);line-height:1;}
.tela-gestao-a-vista :deep(.gv-clock-date){font-family:var(--fonte-principal);font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-top:3px;}
.tela-gestao-a-vista :deep(.gv-update-status){font-family:var(--fonte-principal);font-size:8px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);opacity:.45;margin-top:4px;text-align:right;}
.tela-gestao-a-vista :deep(.gv-cf-bar){display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:7px 28px;border-bottom:1px solid var(--border);background:var(--surface);position:relative;z-index:9;}
.tela-gestao-a-vista :deep(.gv-cf-lbl){font-family:var(--fonte-principal);font-size:8px;letter-spacing:4px;text-transform:uppercase;color:var(--muted);}
.tela-gestao-a-vista :deep(.gv-cf-chips){display:flex;gap:6px;flex-wrap:wrap;}
.tela-gestao-a-vista :deep(.gv-cf-chip){font-family:var(--fonte-principal);font-size:11px;padding:5px 12px;border-radius:999px;border:1px solid var(--border);background:none;color:var(--muted);cursor:pointer;display:inline-flex;align-items:center;gap:6px;}
.tela-gestao-a-vista :deep(.gv-cf-chip.active){background:var(--accent);color:#fff;border-color:var(--accent);}
/* Board layout — 2-column grid: left=gauge panel, right=canal gauges + rankings */
.tela-gestao-a-vista :deep(.gv-board){flex:1;display:grid;grid-template-columns:480px 1fr;gap:1px;background:var(--border);overflow:hidden;min-height:0;position:relative;z-index:2;backdrop-filter:none;}
.tela-gestao-a-vista :deep(.gv-left){background:var(--bg);display:flex;flex-direction:column;align-items:center;padding:8px 22px;gap:0;overflow:hidden;justify-content:space-between;}
/* align-items:safe center — quando o conteúdo é mais alto que a área (telão/dev-tv com
   muitos canais), 'safe' alinha pelo TOPO em vez de centralizar e cortar o topo do
   velocímetro/rótulo (o overflow:hidden cortava o topo). Ao caber, se comporta como center. */
.tela-gestao-a-vista :deep(.gv-gauge-wrap){flex:1;min-height:0;max-height:min(50vh,420px);width:100%;display:flex;align-items:safe center;justify-content:center;}
.tela-gestao-a-vista :deep(.gv-gauge-inner){width:100%;max-width:460px;aspect-ratio:1;}
.tela-gestao-a-vista :deep(.gv-right){display:grid;grid-template-rows:55fr 45fr;gap:1px;background:var(--border);overflow:hidden;min-height:0;}
.tela-gestao-a-vista :deep(.gv-canal-panel){background:var(--bg);padding:7px 12px;display:flex;flex-direction:column;overflow:hidden;}
.tela-gestao-a-vista :deep(.gv-canal-scroll){flex:1;overflow:hidden;min-height:0;display:flex;align-items:safe center;justify-content:center;}
.tela-gestao-a-vista :deep(.gv-canal-scroll-inner){width:100%;}
.tela-gestao-a-vista :deep(.gv-canal-scroll-inner.scrolling){animation:gvRankUp var(--gv-scroll-dur,20s) ease-in-out infinite alternate;}
.tela-gestao-a-vista :deep(.gv-canal-grid){display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;align-content:start;width:100%;}
.tela-gestao-a-vista :deep(.gv-sm-item){display:flex;flex-direction:column;align-items:center;gap:2px;}
.tela-gestao-a-vista :deep(.gv-sm-item-lbl){font-family:var(--fonte-principal);font-size:14px;font-weight:700;letter-spacing:.5px;color:var(--muted);text-align:center;line-height:1.3;overflow-wrap:break-word;word-break:break-word;max-width:100%;}
.tela-gestao-a-vista :deep(.gv-sm-item-val){font-family:var(--fonte-dados);font-size:13px;color:var(--text);}
.tela-gestao-a-vista :deep(.gv-sm-item-delta){font-family:var(--fonte-principal);font-size:9px;font-weight:700;letter-spacing:.3px;text-align:center;}
.tela-gestao-a-vista :deep(.gv-sm-item-delta.up){color:#22c55e;}
.tela-gestao-a-vista :deep(.gv-sm-item-delta.dn){color:#f43f5e;}
.tela-gestao-a-vista :deep(.gv-sm-item-desvio){font-family:var(--fonte-principal);font-size:9px;color:var(--muted);text-align:center;}
.tela-gestao-a-vista :deep(.gv-rank-delta){font-family:var(--fonte-principal);font-size:10px;font-weight:700;flex-shrink:0;margin-right:2px;}
.tela-gestao-a-vista :deep(.gv-rank-delta.up){color:#22c55e;}
.tela-gestao-a-vista :deep(.gv-rank-delta.dn){color:#f43f5e;}
.tela-gestao-a-vista :deep(.gv-rank-desvio){font-family:var(--fonte-principal);font-size:10px;font-weight:600;flex-shrink:0;}
.tela-gestao-a-vista :deep(.gv-rank-desvio.pos){color:#22c55e;}
.tela-gestao-a-vista :deep(.gv-rank-desvio.neg){color:#f43f5e;}
.tela-gestao-a-vista :deep(.gv-rankings){display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--border);overflow:hidden;min-height:0;}
.tela-gestao-a-vista :deep(.gv-rank-panel){background:var(--bg);padding:7px 12px;display:flex;flex-direction:column;overflow:hidden;}
.tela-gestao-a-vista :deep(.gv-rank-scroll){flex:1;overflow:hidden;min-height:0;position:relative;}
.tela-gestao-a-vista :deep(.gv-rank-scroll-inner){display:flex;flex-direction:column;}
@keyframes gvRankUp{0%,8%{transform:translateY(0)}92%,100%{transform:translateY(var(--gv-scroll-h,0px))}}
.tela-gestao-a-vista :deep(.gv-rank-scroll-inner.scrolling){animation:gvRankUp var(--gv-scroll-dur,20s) ease-in-out infinite alternate;}
.tela-gestao-a-vista :deep(.gv-col-grid-label){font-family:var(--fonte-principal);font-size:8px;letter-spacing:4px;text-transform:uppercase;color:var(--muted);margin-bottom:8px;padding-bottom:6px;flex-shrink:0;border-bottom:1px solid var(--border);}
.tela-gestao-a-vista :deep(.gv-main-kpi){font-family:var(--fonte-principal);font-size:9px;letter-spacing:.3px;text-transform:uppercase;color:var(--muted);display:grid;grid-template-columns:repeat(3,1fr);gap:0;flex-shrink:0;border:1px solid var(--border);width:100%;}
.tela-gestao-a-vista :deep(.gv-main-kpi-item){display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;padding:8px 6px;text-align:center;border-right:1px solid var(--border);border-bottom:1px solid var(--border);min-width:0;}
.tela-gestao-a-vista :deep(.gv-main-kpi-item:nth-child(3n)){border-right:none;}
.tela-gestao-a-vista :deep(.gv-main-kpi-item:nth-child(n+4)){border-bottom:none;}
.tela-gestao-a-vista :deep(.gv-main-kpi-v){font-family:var(--fonte-dados);font-size:20px;font-weight:500;color:var(--text);white-space:nowrap;max-width:100%;}
.tela-gestao-a-vista :deep(.gv-main-kpi-l){font-family:var(--fonte-principal);font-size:9px;letter-spacing:.5px;text-transform:uppercase;color:var(--muted);}
.tela-gestao-a-vista :deep(.gv-main-kpi-d){font-family:var(--fonte-principal);font-size:9px;font-weight:700;letter-spacing:.2px;white-space:nowrap;}
.tela-gestao-a-vista :deep(.gv-loading-full){grid-column:1/-1;display:flex;align-items:center;justify-content:center;font-family:var(--fonte-principal);font-size:14px;letter-spacing:4px;text-transform:uppercase;color:var(--muted);opacity:.4;}
@keyframes gvSpin{to{transform:rotate(360deg)}}
.tela-gestao-a-vista :deep(.gv-loading-screen){grid-column:1/-1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;min-height:60vh;}
.tela-gestao-a-vista :deep(.gv-spinner){width:48px;height:48px;border-radius:50%;border:3px solid var(--border);border-top-color:var(--accent);animation:gvSpin .9s linear infinite;}
.tela-gestao-a-vista :deep(.gv-loading-lbl){font-family:var(--fonte-principal);font-size:10px;letter-spacing:4px;text-transform:uppercase;color:var(--muted);opacity:.6;}
/* KPI col */
.tela-gestao-a-vista :deep(.gv-kpi-period){font-family:var(--fonte-principal);font-size:8px;letter-spacing:4px;text-transform:uppercase;color:var(--muted);margin-bottom:3px;flex-shrink:0;}
.tela-gestao-a-vista :deep(.gv-big-num){font-family:var(--fonte-dados);font-size:58px;font-weight:600;letter-spacing:-2px;line-height:1;transition:color .6s,text-shadow .6s;font-variant-numeric:tabular-nums;}
.tela-gestao-a-vista :deep(.gv-big-num.c-white){color:var(--text);}
.tela-gestao-a-vista :deep(.gv-big-num.c-green){color:var(--green);text-shadow:0 0 50px rgba(34,197,94,.18);}
.tela-gestao-a-vista :deep(.gv-big-num.c-yellow){color:var(--yellow);text-shadow:0 0 50px rgba(245,158,11,.15);}
.tela-gestao-a-vista :deep(.gv-big-num.c-red){color:var(--red);text-shadow:0 0 50px rgba(239,68,68,.15);}
/* Progress ring (legado — não usada pelo gauge SVG atual, mantida por fidelidade) */
.tela-gestao-a-vista :deep(.gv-ring-area){display:flex;align-items:center;gap:16px;margin:14px 0;}
.tela-gestao-a-vista :deep(.gv-ring-right){display:flex;flex-direction:column;gap:5px;}
.tela-gestao-a-vista :deep(.gv-ring-pct){font-family:var(--fonte-dados);font-size:40px;font-weight:600;line-height:1;}
.tela-gestao-a-vista :deep(.gv-ring-pct.c-green){color:var(--green);}
.tela-gestao-a-vista :deep(.gv-ring-pct.c-yellow){color:var(--yellow);}
.tela-gestao-a-vista :deep(.gv-ring-pct.c-red){color:var(--red);}
.tela-gestao-a-vista :deep(.gv-ring-pct.c-white){color:var(--text);}
.tela-gestao-a-vista :deep(.gv-ring-meta){font-family:var(--fonte-principal);font-size:9px;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;}
.tela-gestao-a-vista :deep(.gv-ring-meta strong){color:var(--text);font-weight:500;}
/* Gauge liquid shimmer & neon glow */
@keyframes gaugeShimmer{0%{transform:translateX(-220px)}100%{transform:translateX(440px)}}
@keyframes gaugeNeonPulse{0%,100%{opacity:.7}50%{opacity:1}}
.tela-gestao-a-vista :deep(.gauge-shimmer){animation:gaugeShimmer 3.5s linear infinite;}
.tela-gestao-a-vista :deep(.gauge-neon-arc){animation:gaugeNeonPulse 1.8s ease-in-out infinite;}
/* Sub KPIs (legado — não usada pelo layout atual, mantida por fidelidade) */
.tela-gestao-a-vista :deep(.gv-sub-row){display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:auto;}
.tela-gestao-a-vista :deep(.gv-sub-box){background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:11px 13px;}
.tela-gestao-a-vista :deep(.gv-sub-lbl){font-family:var(--fonte-principal);font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:4px;}
.tela-gestao-a-vista :deep(.gv-sub-val){font-family:var(--fonte-dados);font-size:20px;font-weight:500;color:var(--text);}
/* Rank cols */
.tela-gestao-a-vista :deep(.gv-rank-col-hdr){font-family:var(--fonte-principal);font-size:8px;letter-spacing:5px;text-transform:uppercase;color:var(--muted);margin-bottom:6px;display:flex;align-items:center;gap:10px;}
.tela-gestao-a-vista :deep(.gv-rank-col-hdr::after){content:'';flex:1;height:1px;background:var(--border);}
.tela-gestao-a-vista :deep(.gv-rank-entry){display:flex;align-items:flex-start;gap:8px;padding-bottom:5px;margin-bottom:5px;border-bottom:1px solid var(--border);}
.tela-gestao-a-vista :deep(.gv-rank-entry:last-child){border-bottom:none;margin-bottom:0;}
.tela-gestao-a-vista :deep(.gv-rank-num){font-family:var(--fonte-dados);font-size:12px;font-weight:600;width:16px;text-align:center;flex-shrink:0;margin-top:1px;}
.tela-gestao-a-vista :deep(.gv-rank-num.gold){color:#f59e0b;}
.tela-gestao-a-vista :deep(.gv-rank-num.silver){color:#94a3b8;}
.tela-gestao-a-vista :deep(.gv-rank-num.bronze){color:#b87333;}
.tela-gestao-a-vista :deep(.gv-rank-num.rest){color:var(--muted);}
.tela-gestao-a-vista :deep(.gv-rank-body){flex:1;min-width:0;}
.tela-gestao-a-vista :deep(.gv-rank-row){display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px;}
.tela-gestao-a-vista :deep(.gv-rank-nm){font-family:var(--fonte-principal);font-size:14px;font-weight:400;color:var(--text);overflow-wrap:break-word;word-break:break-word;line-height:1.3;}
.tela-gestao-a-vista :deep(.gv-rank-v){font-family:var(--fonte-dados);font-size:17px;font-weight:500;color:var(--text);flex-shrink:0;margin-left:6px;}
.tela-gestao-a-vista :deep(.gv-rank-bar){height:4px;background:var(--surface2);border-radius:2px;overflow:hidden;}
.tela-gestao-a-vista :deep(.gv-rank-bar-fill){height:100%;border-radius:2px;transition:width 1.8s cubic-bezier(.4,0,.2,1);}
.tela-gestao-a-vista :deep(.gv-rank-bar-fill.gold){background:linear-gradient(90deg,#d97706,#fbbf24);}
.tela-gestao-a-vista :deep(.gv-rank-bar-fill.silver){background:linear-gradient(90deg,#475569,#94a3b8);}
.tela-gestao-a-vista :deep(.gv-rank-bar-fill.bronze){background:linear-gradient(90deg,#78350f,#b87333);}
.tela-gestao-a-vista :deep(.gv-rank-bar-fill.rest){background:linear-gradient(90deg,var(--accent-mid),var(--accent));}
.tela-gestao-a-vista :deep(.gv-rank-hint){font-family:var(--fonte-principal);font-size:12px;color:var(--muted);margin-top:1px;}
/* Ticker */
.tela-gestao-a-vista :deep(.gv-ticker){border-top:1px solid var(--border);padding:0 28px;display:flex;align-items:center;gap:16px;background:var(--surface2);flex-shrink:0;height:30px;overflow:hidden;position:relative;z-index:2;transition:opacity .35s ease;}
.tela-gestao-a-vista :deep(.gv-ticker-lbl){font-family:var(--fonte-principal);font-size:8px;letter-spacing:4px;text-transform:uppercase;color:var(--accent);flex-shrink:0;min-width:130px;}
.tela-gestao-a-vista :deep(.gv-ticker-sep){width:1px;height:14px;background:var(--border);flex-shrink:0;}
.tela-gestao-a-vista :deep(.gv-ticker-outer){flex:1;overflow:hidden;}
.tela-gestao-a-vista :deep(.gv-ticker-inner){display:flex;gap:48px;white-space:nowrap;}
.tela-gestao-a-vista :deep(.gv-ticker-inner.animate){animation:gvTickerBF var(--ticker-dur,14s) ease-in-out 2 alternate;}
@keyframes gvTickerBF{0%,4%{transform:translateX(0)}96%,100%{transform:translateX(var(--ticker-travel,0px))}}
.tela-gestao-a-vista :deep(.gv-ticker-item){font-family:var(--fonte-principal);font-size:12px;color:var(--muted);flex-shrink:0;}
.tela-gestao-a-vista :deep(.gv-ticker-item strong){color:var(--text);}
.tela-gestao-a-vista :deep(.gv-ticker-dot){display:inline-block;width:3px;height:3px;border-radius:50%;background:var(--accent);vertical-align:middle;margin:0 14px;}
.tela-gestao-a-vista :deep(.gv-refresh-tag){font-family:var(--fonte-principal);font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);opacity:.4;flex-shrink:0;}
/* GV animated background */
.tela-gestao-a-vista :deep(#gv-bg-anim){position:absolute;left:0;right:0;top:40px;bottom:30px;z-index:0;pointer-events:none;overflow:hidden;opacity:1;}
.tela-gestao-a-vista :deep(#gv-bg-anim svg){width:100%;height:100%;position:absolute;inset:0;}
@keyframes gvBgRise{0%{transform:translateY(90px)}100%{transform:translateY(-90px)}}
/* GV panels: semi-transparent so animated background shows through */
.tela-gestao-a-vista :deep(.gv-left), .tela-gestao-a-vista :deep(.gv-canal-panel), .tela-gestao-a-vista :deep(.gv-rank-panel){background:rgba(255,255,255,.60)!important;}
[data-theme="dark"] .tela-gestao-a-vista :deep(.gv-left), [data-theme="dark"] .tela-gestao-a-vista :deep(.gv-canal-panel), [data-theme="dark"] .tela-gestao-a-vista :deep(.gv-rank-panel){background:rgba(10,11,20,.60)!important;}
/* prefers-reduced-motion (só a parte que é desta tela) */
@media(prefers-reduced-motion:reduce){
  .tela-gestao-a-vista :deep(.gauge-shimmer){animation:none!important;}
}
/* Botão de período (compartilhado com Análise de Vendas/Meta Ads/GT no legado —
   aqui portado só para a Gestão à Vista, que é a única já migrada) */
.tela-gestao-a-vista :deep(.gv-period-btns){display:flex;align-items:center;gap:4px;}
.tela-gestao-a-vista :deep(.gv-pbtn){font-family:var(--fonte-principal);font-size:10px;padding:4px 9px;border-radius:5px;border:1px solid var(--border);background:none;color:var(--muted);cursor:pointer;transition:all .15s;}
.tela-gestao-a-vista :deep(.gv-pbtn.active){background:var(--accent);color:#fff;border-color:var(--accent);}
/* Auto-ciclo (idem — classe compartilhada, portada só aqui) */
.tela-gestao-a-vista :deep(.vs-ac-toggle){font-family:var(--fonte-principal);font-size:10px;letter-spacing:.8px;text-transform:uppercase;padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:none;color:var(--muted);cursor:pointer;transition:all .15s;margin-left:6px;}
.tela-gestao-a-vista :deep(.vs-ac-toggle.running){border-color:var(--green);color:var(--green);}

/* ── RESPONSIVE: GESTÃO À VISTA (legacy L625-767) ── */
@media(max-width:1024px){
  .tela-gestao-a-vista{height:auto;min-height:100vh;max-height:none;overflow-y:auto;-webkit-overflow-scrolling:touch;}
  .tela-gestao-a-vista :deep(#gv-bg-anim){display:none;}
  .tela-gestao-a-vista :deep(.gv-board){display:flex;flex-direction:column;gap:1px;background:var(--border);overflow:visible;min-height:0;padding:0;}
  .tela-gestao-a-vista :deep(.gv-left){overflow:visible;flex:none;min-height:auto;padding:16px 20px;gap:12px;justify-content:flex-start;}
  .tela-gestao-a-vista :deep(.gv-gauge-wrap){flex:none;min-height:0;height:260px;max-height:260px;}
  .tela-gestao-a-vista :deep(.gv-right){display:flex;flex-direction:column;gap:1px;background:var(--border);overflow:visible;min-height:0;}
  .tela-gestao-a-vista :deep(.gv-canal-panel){overflow:visible;padding:12px 16px;}
  .tela-gestao-a-vista :deep(.gv-canal-scroll){display:block;overflow:visible;flex:none;min-height:0;}
  .tela-gestao-a-vista :deep(.gv-canal-grid){grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:6px;}
  .tela-gestao-a-vista :deep(.gv-canal-scroll-inner){animation:none!important;transform:none!important;}
  .tela-gestao-a-vista :deep(.gv-rankings){display:flex;flex-direction:column;gap:1px;background:var(--border);overflow:visible;min-height:0;}
  .tela-gestao-a-vista :deep(.gv-rank-panel){overflow:visible;padding:12px 16px;}
  .tela-gestao-a-vista :deep(.gv-rank-scroll){overflow:visible;flex:none;min-height:0;}
  .tela-gestao-a-vista :deep(.gv-rank-scroll-inner){animation:none!important;transform:none!important;}
  .tela-gestao-a-vista :deep(.gv-topbar){flex-wrap:wrap;padding:8px 14px;gap:6px;}
  .tela-gestao-a-vista :deep(.gv-clock-wrap){display:none;}
  .tela-gestao-a-vista :deep(.gv-ticker){height:auto;flex-shrink:0;padding:8px 12px;gap:6px;}
  .tela-gestao-a-vista :deep(.gv-ticker-outer){flex:1;overflow-x:auto;}
  .tela-gestao-a-vista :deep(.gv-ticker-inner){white-space:nowrap;}
  .tela-gestao-a-vista :deep(.gv-ticker-inner.animate){animation:none;}
}
@media(max-width:640px){
  .tela-gestao-a-vista :deep(.gv-topbar){padding:6px 10px;}
  .tela-gestao-a-vista :deep(.gv-brand-tag){display:none;}
  .tela-gestao-a-vista :deep(.gv-period-btns){flex-wrap:wrap;gap:3px;}
  .tela-gestao-a-vista :deep(.gv-pbtn){font-size:9px;padding:3px 7px;border-radius:4px;}
  .tela-gestao-a-vista :deep(#gv-ac-toggle){font-size:9px;padding:3px 7px;}
  .tela-gestao-a-vista :deep(.gv-update-status){display:none;}
  .tela-gestao-a-vista :deep(.gv-left){display:grid!important;grid-template-columns:42% 1fr;grid-template-rows:auto 1fr;padding:8px 12px;gap:4px 10px;align-items:start;flex:none;}
  .tela-gestao-a-vista :deep(.gv-kpi-period){grid-column:1/-1;margin-bottom:0;}
  .tela-gestao-a-vista :deep(.gv-gauge-wrap){grid-column:1;grid-row:2;height:auto!important;max-height:none!important;align-self:center;}
  .tela-gestao-a-vista :deep(.gv-gauge-inner){max-width:none;}
  .tela-gestao-a-vista :deep(.gv-main-kpi){display:flex!important;grid-column:2;grid-row:2;flex-direction:column;align-items:flex-start;flex-wrap:nowrap;gap:5px;padding:4px 0;justify-content:center;border-top:none;border-bottom:none;}
  .tela-gestao-a-vista :deep(.gv-main-kpi-item){display:flex!important;flex-direction:row;align-items:baseline;flex-wrap:wrap;gap:3px;row-gap:0;padding:2px 0;border-right:none;}
  .tela-gestao-a-vista :deep(.gv-main-kpi-v){font-size:14px;}
  .tela-gestao-a-vista :deep(.gv-main-kpi-l){font-size:8px;letter-spacing:.3px;}
  .tela-gestao-a-vista :deep(.gv-main-kpi-d){font-size:8px;width:100%;}
  .tela-gestao-a-vista :deep(.gv-canal-panel), .tela-gestao-a-vista :deep(.gv-rank-panel){padding:8px 12px;}
  .tela-gestao-a-vista :deep(.gv-canal-grid){grid-template-columns:repeat(3,1fr);gap:6px;}
  .tela-gestao-a-vista :deep(.gv-rankings){display:flex!important;flex-direction:column;}
  .tela-gestao-a-vista :deep(.gv-big-num){font-size:30px;}
  .tela-gestao-a-vista :deep(.gv-ticker-lbl){font-size:9px;min-width:80px;}
  .tela-gestao-a-vista :deep(.gv-ticker-item){font-size:11px;}
}
/* ── GESTÃO À VISTA · MOBILE (≤480px) — seletores com id para especificidade,
   igual ao legado (comentário original: "supera o CSS desktop independente
   da ordem no arquivo") ── */
@media(max-width:480px){
  #gestao-vista-screen.tela-gestao-a-vista{height:100svh!important;max-height:100svh!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch;flex-direction:column;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-topbar){flex-wrap:wrap;padding:0;gap:0;border-bottom:1px solid var(--border);flex-shrink:0;position:sticky;top:0;z-index:10;background:var(--surface);}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-topbar-brand){order:1;flex:1;min-width:0;display:flex;align-items:center;gap:8px;padding:10px 14px;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-topbar .rbv-logo){display:none;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-perf-tag){font-size:10px;letter-spacing:3px;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-brand-tag){display:none;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-clock-wrap){display:none;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-update-status){display:none;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-period-btns){order:2;width:100%;box-sizing:border-box;overflow-x:auto;-webkit-overflow-scrolling:touch;display:flex;flex-wrap:nowrap;gap:4px;padding:7px 14px 9px;border-top:1px solid var(--border);background:var(--surface);}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-pbtn){font-size:10px;padding:5px 11px;flex-shrink:0;border-radius:4px;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(#gv-ac-toggle){flex-shrink:0;font-size:9px;padding:5px 10px;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-board){display:flex;flex-direction:column;gap:12px;background:var(--surface2);overflow:visible;height:auto;min-height:0;flex:none;padding:12px;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-left){display:flex!important;flex-direction:column;align-items:center;padding:16px;gap:12px;overflow:visible;height:auto;background:var(--surface);border:1px solid var(--border);border-radius:6px;width:100%;box-sizing:border-box;flex:none;justify-content:flex-start;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-kpi-period){align-self:flex-start;grid-column:unset;grid-row:unset;margin:0;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-col-grid-label.gv-main-chart-title){align-self:flex-start;grid-column:unset;margin:0;border-bottom:none;padding-bottom:0;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-gauge-wrap){flex:none;grid-column:unset;grid-row:unset;height:auto;max-height:none;min-height:0;width:100%;max-width:196px;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-gauge-inner){width:100%;max-width:none;aspect-ratio:200/190;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-big-num){font-size:24px;letter-spacing:-0.5px;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-main-kpi){display:grid!important;grid-template-columns:repeat(2,1fr)!important;grid-column:unset;grid-row:unset;align-items:stretch;width:100%;border:1px solid var(--border);border-radius:4px;overflow:hidden;gap:0;padding:0;flex-wrap:unset;flex-shrink:0;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-main-kpi-item){display:flex!important;flex-direction:column!important;align-items:center;text-align:center;padding:12px 8px;border-right:1px solid var(--border);border-bottom:1px solid var(--border);border-left:none;border-top:none;flex-wrap:unset;row-gap:unset;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-main-kpi-item:nth-child(2n)){border-right:none;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-main-kpi-item:nth-child(n+3)){border-bottom:none;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-main-kpi-v){font-size:16px;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-main-kpi-l){font-size:8px;letter-spacing:.5px;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-main-kpi-d){font-size:9px;width:auto;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-right){display:flex;flex-direction:column;gap:12px;background:transparent;overflow:visible;height:auto;min-height:0;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-canal-panel){display:flex;flex-direction:column;gap:10px;overflow:visible;height:auto;padding:14px;background:var(--surface);border:1px solid var(--border);border-radius:6px;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-col-grid-label){border-bottom:none;padding-bottom:0;margin-bottom:0;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-canal-scroll){display:block;overflow:visible;flex:none;height:auto;min-height:0;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-canal-scroll-inner){animation:none;transform:none;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-canal-grid){display:grid;grid-template-columns:repeat(2,1fr);gap:8px;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-sm-item){display:flex!important;flex-direction:column!important;align-items:center;padding:12px 8px 8px;gap:6px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;text-align:center;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-sm-item-lbl){font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted);width:100%;word-break:break-word;line-height:1.2;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-sm-item svg){width:100%!important;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-sm-item-val){display:none;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-sm-item-delta){display:none;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-sm-item-desvio){display:none;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-rankings){display:flex;flex-direction:column;gap:12px;background:transparent;overflow:visible;height:auto;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-rank-panel){display:flex;flex-direction:column;gap:10px;overflow:visible;height:auto;padding:16px;background:var(--surface);border:1px solid var(--border);border-radius:6px;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-rank-col-hdr){margin-bottom:0;font-size:8px;letter-spacing:4px;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-rank-scroll){overflow:visible;flex:none;height:auto;min-height:0;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-rank-scroll-inner){display:flex;flex-direction:column;animation:none;transform:none;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-rank-entry){margin-bottom:8px;padding-bottom:8px;gap:8px;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-rank-entry:last-child){margin-bottom:0;padding-bottom:0;border-bottom:none;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-rank-num){font-size:11px;width:16px;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-rank-nm){font-size:12px;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-rank-v){font-size:13px;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-rank-hint){font-size:9px;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-rank-bar){height:3px;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-rank-delta){font-size:9px;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-rank-desvio){font-size:9px;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-ticker){height:auto;padding:8px 14px;gap:6px;flex-shrink:0;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-ticker-sep){display:none;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-ticker-outer){flex:1;overflow-x:auto;-webkit-overflow-scrolling:touch;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-ticker-inner){white-space:nowrap;animation:none;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-ticker-lbl){font-size:8px;min-width:72px;letter-spacing:2px;}
  #gestao-vista-screen.tela-gestao-a-vista :deep(.gv-ticker-item){font-size:10px;}
}
/* ── GV DESKTOP RESPONSIVO (1025px–1600px) ── */
@media(min-width:1025px) and (max-width:1600px){
  .tela-gestao-a-vista :deep(.gv-board){grid-template-columns:360px 1fr;}
  .tela-gestao-a-vista :deep(.gv-gauge-wrap){max-height:min(42vh,340px);}
  .tela-gestao-a-vista :deep(.gv-left){padding:6px 14px;}
  .tela-gestao-a-vista :deep(.gv-main-kpi){gap:0;}
  .tela-gestao-a-vista :deep(.gv-main-kpi-v){font-size:16px;}
  .tela-gestao-a-vista :deep(.gv-main-kpi-l){font-size:8px;}
  .tela-gestao-a-vista :deep(.gv-main-kpi-d){font-size:8px;}
  .tela-gestao-a-vista :deep(.gv-canal-grid){grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:7px;}
  .tela-gestao-a-vista :deep(.gv-sm-item-lbl){font-size:11px;}
  .tela-gestao-a-vista :deep(.gv-rank-nm){font-size:12px;}
  .tela-gestao-a-vista :deep(.gv-rank-v){font-size:14px;}
  .tela-gestao-a-vista :deep(.gv-rank-hint){font-size:10px;}
  .tela-gestao-a-vista :deep(.gv-rank-num){font-size:11px;}
  .tela-gestao-a-vista :deep(.gv-rank-entry){margin-bottom:4px;}
  .tela-gestao-a-vista :deep(.gv-col-grid-label){font-size:7px;}
  .tela-gestao-a-vista :deep(.gv-kpi-period){font-size:7px;}
}
@media(min-width:1025px) and (max-width:1280px){
  .tela-gestao-a-vista :deep(.gv-board){grid-template-columns:320px 1fr;}
  .tela-gestao-a-vista :deep(.gv-gauge-wrap){max-height:min(38vh,300px);}
  .tela-gestao-a-vista :deep(.gv-canal-grid){grid-template-columns:repeat(auto-fit,minmax(95px,1fr));gap:5px;}
  .tela-gestao-a-vista :deep(.gv-sm-item-lbl){font-size:10px;}
  .tela-gestao-a-vista :deep(.gv-rank-nm){font-size:11px;}
  .tela-gestao-a-vista :deep(.gv-rank-v){font-size:13px;}
}
/* ── TV OVERRIDES (≥1920px) — ativadas por body.dev-tv, um toggle ainda não
   exposto na UI Vue (existia no menu de administração do legado) ── */
body.dev-tv .tela-gestao-a-vista :deep(.gv-board){grid-template-columns:1fr 2fr;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-right){grid-template-rows:62fr 38fr;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-left){padding:20px 36px;gap:0;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-gauge-wrap){max-height:none;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-gauge-inner){max-width:680px;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-canal-panel){padding:18px 28px;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-canal-grid){grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-rank-panel){padding:18px 44px;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-clock-time){font-size:72px;letter-spacing:5px;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-clock-date){font-size:20px;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-kpi-period){font-size:20px;letter-spacing:4px;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-col-grid-label){font-size:20px;margin-bottom:14px;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-main-kpi){grid-template-columns:repeat(3,1fr);}
body.dev-tv .tela-gestao-a-vista :deep(.gv-main-kpi-item){padding:16px 20px;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-main-kpi-v){font-size:48px;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-main-kpi-l){font-size:20px;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-main-kpi-d){font-size:22px;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-rank-col-hdr){font-size:20px;letter-spacing:5px;margin-bottom:20px;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-rank-num){font-size:30px;width:36px;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-rank-nm){font-size:30px;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-rank-v){font-size:39px;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-rank-hint){font-size:23px;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-rank-entry){margin-bottom:20px;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-rank-bar){height:9px;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-sm-item-lbl){font-size:30px;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-sm-item-val){font-size:24px;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-sm-item-delta){font-size:18px;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-sm-item-desvio){font-size:17px;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-rank-delta){font-size:22px;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-rank-desvio){font-size:20px;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-ticker){height:70px;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-ticker-lbl){font-size:20px;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-ticker-item){font-size:30px;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-ticker-dot){width:6px;height:6px;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-topbar){padding:22px 56px;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-back){font-size:18px;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-brand-tag){font-size:16px;color:var(--text);}
body.dev-tv .tela-gestao-a-vista :deep(.gv-perf-tag){font-size:24px;color:var(--text);}
body.dev-tv .tela-gestao-a-vista :deep(.gv-main-chart-title){font-size:20px!important;font-weight:700!important;color:var(--text)!important;}
body.dev-tv .tela-gestao-a-vista :deep(.gv-pbtn){font-size:21px;padding:8px 19px;border-radius:8px;}
body.dev-tv .tela-gestao-a-vista :deep(#gv-ac-toggle){font-size:21px;padding:8px 17px;}

/* ── Estoque por canal (Task 3) — prefixo gv-est-* pra não colidir com nada
   global; segue os mesmos tokens de tema da tela (funciona claro/escuro). */
.tela-gestao-a-vista :deep(.gv-est){border-top:1px solid var(--border);background:var(--surface);flex-shrink:0;position:relative;z-index:2;}
.tela-gestao-a-vista :deep(.gv-est-head){width:100%;display:flex;align-items:center;gap:10px;padding:6px 28px;background:none;border:none;cursor:pointer;font-family:var(--fonte-principal);text-align:left;}
.tela-gestao-a-vista :deep(.gv-est-caret){font-size:9px;color:var(--accent);transition:transform .15s ease;display:inline-block;}
.tela-gestao-a-vista :deep(.gv-est.open .gv-est-caret){transform:rotate(90deg);}
.tela-gestao-a-vista :deep(.gv-est-t){font-size:9px;letter-spacing:3px;text-transform:uppercase;color:var(--text);font-weight:600;}
.tela-gestao-a-vista :deep(.gv-est-sub){font-size:9px;letter-spacing:1px;color:var(--muted);opacity:.7;}
.tela-gestao-a-vista :deep(.gv-est-body[hidden]){display:none;}
.tela-gestao-a-vista :deep(.gv-est-body){padding:0 28px 14px;max-height:38vh;overflow-y:auto;}
.tela-gestao-a-vista :deep(.gv-est-controls){display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px;}
.tela-gestao-a-vista :deep(.gv-est-search){flex:1;min-width:160px;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:6px 10px;font-family:var(--fonte-principal);font-size:11px;}
.tela-gestao-a-vista :deep(.gv-est-search::placeholder){color:var(--muted);}
.tela-gestao-a-vista :deep(.gv-est-sel){background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:6px 8px;font-family:var(--fonte-principal);font-size:11px;}
.tela-gestao-a-vista :deep(.gv-est-count){font-size:10px;color:var(--muted);letter-spacing:.3px;margin-left:auto;white-space:nowrap;}
.tela-gestao-a-vista :deep(.gv-est-cols){display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;}
.tela-gestao-a-vista :deep(.gv-est-col){border:1px solid var(--border);border-radius:8px;background:var(--bg);overflow:hidden;}
.tela-gestao-a-vista :deep(.gv-est-colh){display:flex;align-items:center;justify-content:space-between;padding:7px 10px;background:var(--surface2);border-bottom:1px solid var(--border);font-size:10px;letter-spacing:.5px;color:var(--text);font-weight:600;}
.tela-gestao-a-vista :deep(.gv-est-tot){font-family:var(--fonte-dados);font-size:10px;color:var(--muted);font-weight:400;}
.tela-gestao-a-vista :deep(.gv-est-row){display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid var(--border);}
.tela-gestao-a-vista :deep(.gv-est-row:last-child){border-bottom:none;}
.tela-gestao-a-vista :deep(.gv-est-info){display:flex;flex-direction:column;gap:1px;flex:1;min-width:0;}
.tela-gestao-a-vista :deep(.gv-est-sku){font-family:var(--fonte-dados);font-size:11px;color:var(--accent);font-weight:600;}
.tela-gestao-a-vista :deep(.gv-est-nm){font-size:10px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.tela-gestao-a-vista :deep(.gv-est-pill){font-size:8px;letter-spacing:.5px;text-transform:uppercase;padding:2px 7px;border-radius:999px;flex-shrink:0;font-weight:600;}
.tela-gestao-a-vista :deep(.gv-est-pill-ok){background:color-mix(in srgb, var(--green) 18%, transparent);color:var(--green);}
.tela-gestao-a-vista :deep(.gv-est-pill-low){background:color-mix(in srgb, var(--yellow) 20%, transparent);color:var(--yellow);}
.tela-gestao-a-vista :deep(.gv-est-pill-crit){background:color-mix(in srgb, var(--red) 20%, transparent);color:var(--red);}
.tela-gestao-a-vista :deep(.gv-est-q){font-family:var(--fonte-dados);font-size:12px;color:var(--text);font-weight:600;min-width:28px;text-align:right;flex-shrink:0;}
.tela-gestao-a-vista :deep(.gv-est-more){padding:6px 10px;font-size:9px;color:var(--muted);text-align:center;}
.tela-gestao-a-vista :deep(.gv-est-empty){padding:12px 10px;font-size:10px;color:var(--muted);text-align:center;}
@media (max-width:768px){
  .tela-gestao-a-vista :deep(.gv-est-head){padding:6px 14px;}
  .tela-gestao-a-vista :deep(.gv-est-body){padding:0 14px 12px;}
  .tela-gestao-a-vista :deep(.gv-est-count){margin-left:0;width:100%;}
  .tela-gestao-a-vista :deep(.gv-est-cols){grid-template-columns:1fr;}
}
</style>
