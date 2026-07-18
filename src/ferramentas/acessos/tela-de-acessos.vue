<template>
  <!-- Template = HTML de #acessos-screen do legado (legacy/index.html L12197-12211),
       VERBATIM. Mantido o id="acessos-screen" (usado por getElementById/querySelector
       no JS imperativo abaixo) + class="tela-acessos" pro CSS com escopo. Única troca:
       o botão "Central" usava onclick="closeAcessos()" → agora navega pelo router
       (@click="voltar"). Os demais onclick="_acSetTab('...')" ficam como STRING literal
       (igual ao legado) porque são atributos HTML nativos, não bindings do Vue — por
       isso _acSetTab (e todo o cluster _ac*) é exposto em window mais abaixo. -->
  <div id="acessos-screen" class="tela-acessos">
    <div class="ac-topbar">
      <button class="ac-back" @click="voltar">← Central</button>
    </div>

    <!-- ============================================================
         TOPO NOVO (Tarefa 2 do redesign): cabeçalho comum + faixa de
         4 KPIs, acima das abas. Fica como markup ESTÁTICO aqui no
         <template> (não montado por innerHTML), então o CSS scoped
         normal já alcança — não precisa de :deep pra esta parte.
         Os valores que mudam (bolinhas de status e números dos KPIs)
         têm id e são preenchidos por JS no onMounted, atualizando só
         o texto/classe dos elementos que já existem aqui.
         ============================================================ -->
    <div class="ac-topo">
      <!-- Cabeçalho: marca RB + título + subtítulo + pills de provedor -->
      <div class="ac-hero">
        <div class="ac-hero-brand">
          <div class="ac-hero-mark">RB</div>
          <div>
            <h1 class="ac-hero-h1">Colaboradores &amp; Acessos</h1>
            <div class="ac-hero-sub">Central de controle de pastas, pessoas e permissões — RBV&nbsp;Company</div>
          </div>
        </div>
        <div class="ac-hero-provs">
          <!-- Zoho e Microsoft têm status REAL (consultado no acessos-proxy).
               A bolinha começa cinza ("verificando") e o JS pinta verde
               (conectado) ou âmbar (não conectado); se a consulta falhar,
               fica cinza com "status indisponível" — nunca em silêncio. -->
          <div class="ac-hero-prov" id="ac-prov-zoho-pill" title="Verificando conexão…">
            <span class="ac-hero-dot" id="ac-prov-zoho"></span>Zoho WorkDrive<span class="ac-hero-prov-note" id="ac-prov-zoho-note">verificando…</span>
          </div>
          <div class="ac-hero-prov" id="ac-prov-ms-pill" title="Verificando conexão…">
            <span class="ac-hero-dot" id="ac-prov-ms"></span>Microsoft&nbsp;365<span class="ac-hero-prov-note" id="ac-prov-ms-note">verificando…</span>
          </div>
          <!-- iCloud é provedor legado/manual: não tem API de status pra
               consultar, então fica sempre âmbar ("legado"), fixo. -->
          <div class="ac-hero-prov" title="Provedor legado (controle manual, sem conexão automática)">
            <span class="ac-hero-dot leg"></span>iCloud
          </div>
        </div>
      </div>

      <!-- Faixa de 4 KPIs. Números começam com "…" e o JS troca pelos
           reais; se algum não der pra calcular de forma barata/confiável,
           o JS mostra "—" com um title explicando (honestidade > número). -->
      <div class="ac-kpis">
        <div class="ac-kpi k1">
          <div class="ac-kpi-rail"></div>
          <div class="ac-kpi-lab">Pastas geridas</div>
          <div class="ac-kpi-val tnum" id="ac-kpi-pastas">…</div>
          <div class="ac-kpi-fine" id="ac-kpi-pastas-fine">carregando…</div>
        </div>
        <div class="ac-kpi k2">
          <div class="ac-kpi-rail"></div>
          <div class="ac-kpi-lab">Pessoas com acesso</div>
          <div class="ac-kpi-val tnum" id="ac-kpi-pessoas">…</div>
          <div class="ac-kpi-fine">colaboradores ativos</div>
        </div>
        <div class="ac-kpi k3">
          <div class="ac-kpi-rail"></div>
          <div class="ac-kpi-lab">Compartilhamentos</div>
          <div class="ac-kpi-val tnum" id="ac-kpi-shares">…</div>
          <div class="ac-kpi-fine" id="ac-kpi-shares-fine">vínculos pessoa–pasta registrados</div>
        </div>
        <div class="ac-kpi k4">
          <div class="ac-kpi-rail"></div>
          <div class="ac-kpi-lab">Provedores</div>
          <div class="ac-kpi-val tnum">3</div>
          <div class="ac-kpi-fine">1 ativo · 2 legado</div>
        </div>
      </div>
    </div>

    <div class="ac-navbar">
      <div class="ac-tabs">
        <button class="ac-tab" data-tab="org" onclick="_acSetTab('org')">Organizações</button>
        <button class="ac-tab" data-tab="drive" onclick="_acSetTab('drive')">Drive</button>
        <button class="ac-tab" data-tab="auditoria" onclick="_acSetTab('auditoria')">Auditoria</button>
        <button class="ac-tab" data-tab="config" onclick="_acSetTab('config')" title="Configurações" style="padding:6px 10px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button>
      </div>
    </div>
    <div class="ac-body" id="ac-body"></div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { sbClient, SUPABASE_URL, SUPABASE_ANON_KEY } from '../../compartilhado/conectar-no-banco-de-dados.js'
import { adminToast } from '../../compartilhado/avisos.js'
import { hasPermission, estado } from '../../compartilhado/controle-de-login-e-usuario.js'
import { hojeLocal } from '../../compartilhado/datas.js'
import { montarArvoreDePastas } from './montar-arvore-de-pastas.js'
import { montarDetalhePastas } from './montar-textos-do-topo.js'

const router = useRouter()

// Equivalente ao closeAcessos() do legado (que fazia display:none + showHome()).
// No Vue quem controla a visibilidade é o vue-router, então basta navegar de volta.
function voltar() {
  router.push({ name: 'inicio' })
}

// ==========================================================================
// PORTE VERBATIM do Controle de Acessos (legacy/index.html L9703-11137, menos
// openAcessos/closeAcessos — L9974-9990 do legado — substituídos pela guarda
// de permissão + reset de estado abaixo, e por voltar() acima).
//
// Dependências externas resolvidas:
//   - sbClient, SUPABASE_URL, SUPABASE_ANON_KEY  → import (conectar-no-banco-de-dados.js)
//   - adminToast                                  → import (avisos.js)
//   - hasPermission, estado                       → import (controle-de-login-e-usuario.js)
//   - currentUserRole (legado)                    → trocado por estado.role
//   - AC_DST/AC_DEV_TIPOS/AC_VEI_TIPOS/AC_COMB/AC_FIELDDEFS, _AC_SECTORS → self-contidos,
//     definidos dentro deste mesmo bloco (nada externo a resolver).
//
// Nada foi reescrito para template reativo — segue montando HTML via
// getElementById/createElement/innerHTML, exatamente como a produção atual.
// Por isso todo o cluster _ac* é exposto em window no fim deste bloco (para
// os onclick="..."/onchange="..."/ondrag...="..." embutidos nas strings HTML
// geradas em runtime, e para os onclick="_acSetTab(...)" do <template> acima
// continuarem funcionando).
// ==========================================================================
/* ===== Controle de Acessos (base manual) ===== */
let _acData={organizacoes:[],setores:[],pessoas:[],config:null};
let _acSel=null;      // id da pessoa aberta (ou null)
let _acSelSetor=null; // id do setor aberto (ou null, ou false para "sem setor")
let _acSelOrg=null;
let _acTab='setores';
function _acEsc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function _acLogo(k){
  if(k==='ms')return '<svg width="13" height="13" viewBox="0 0 24 24" style="vertical-align:-2px;margin-right:5px"><rect x="1" y="1" width="10" height="10" fill="#F25022"/><rect x="13" y="1" width="10" height="10" fill="#7FBA00"/><rect x="1" y="13" width="10" height="10" fill="#00A4EF"/><rect x="13" y="13" width="10" height="10" fill="#FFB900"/></svg>';
  if(k==='apple')return '<svg width="13" height="13" viewBox="0 0 24 24" style="vertical-align:-2px;margin-right:5px" fill="currentColor"><path d="M16.365 1.43c0 1.14-.42 2.2-1.12 2.98-.84.94-2.21 1.66-3.34 1.57-.14-1.1.43-2.27 1.1-3 .76-.83 2.13-1.46 3.36-1.55zM20.5 17.4c-.55 1.27-.82 1.84-1.53 2.96-.99 1.57-2.39 3.52-4.12 3.53-1.54.01-1.94-1-4.03-.99-2.09.01-2.53 1.01-4.07.99-1.73-.02-3.06-1.78-4.05-3.34-2.06-3.18-2.33-8.68-.13-11.6 1.07-1.45 2.76-2.37 4.31-2.37 1.58 0 2.57 1.01 3.88 1.01 1.27 0 2.04-1.01 3.87-1.01 1.38 0 2.84.75 3.88 2.05-3.41 1.87-2.86 6.74.49 8.24z"/></svg>';
  if(k==='zoho')return '<svg width="13" height="13" viewBox="0 0 24 24" style="vertical-align:-2px;margin-right:5px"><rect width="24" height="24" rx="5" fill="#e1251b"/><path d="M6.5 8h9l-8 8h9" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return '';
}
function _acAvatar(c,sz){sz=sz||40;
  if(c&&c.avatar_url)return `<img class="ac-avatar" src="${_acEsc(c.avatar_url)}" alt="" style="width:${sz}px;height:${sz}px">`;
  const ini=_acEsc(((c&&c.nome)||'?').trim().charAt(0).toUpperCase()||'?');
  return `<div class="ac-avatar ac-avatar-fb" style="width:${sz}px;height:${sz}px;font-size:${Math.round(sz*0.42)}px">${ini}</div>`;
}
async function _acLog(acao,alvo,resultado,detalhe){
  try{const{data:{session:s}}=await sbClient.auth.getSession();
    await sbClient.from('acessos_log').insert({quem:s?.user?.id||null,acao,alvo:alvo||null,resultado:resultado||'ok',detalhe:detalhe||null});}catch(e){}
}
async function _acProxy(action,args){
  const{data:{session:s}}=await sbClient.auth.getSession();
  const tok=s?.access_token||SUPABASE_ANON_KEY;
  const r=await fetch(SUPABASE_URL+'/functions/v1/acessos-proxy',{method:'POST',headers:{Authorization:'Bearer '+tok,'Content-Type':'application/json'},body:JSON.stringify(Object.assign({action},args||{}))});
  let j={};try{j=await r.json();}catch(e){}
  if(!r.ok)throw new Error(j.error||('HTTP '+r.status));
  return j;
}
async function _acZohoStatus(){
  const el=document.getElementById('ac-zoho-status');const imp=document.getElementById('ac-zoho-import');if(!el)return;
  try{const s=await _acProxy('zoho.status');
    if(s&&s.connected){el.innerHTML='<span class="ac-pill ok">conectado</span>'+(s.conectado_em?' <span class="ac-muted">desde '+_acEsc(new Date(s.conectado_em).toLocaleDateString('pt-BR'))+'</span>':'');if(imp)imp.style.display='';}
    else{el.innerHTML='<span class="ac-pill neutral">não conectado</span>';if(imp)imp.style.display='none';}
  }catch(e){el.innerHTML='<span class="ac-muted">status indisponível</span>';if(imp)imp.style.display='none';}
}
async function _acConectarZoho(){
  try{const r=await _acProxy('zoho.authUrl');if(r&&r.url)window.location.href=r.url;else adminToast('Falha ao iniciar conexão',false);}
  catch(e){adminToast('Erro: '+e.message,false);}
}
async function _acODStatus(){
  const el=document.getElementById('ac-od-status');if(!el)return;
  const mg=document.getElementById('ac-od-manage');
  try{const s=await _acProxy('microsoft.status');
    if(s&&s.connected){el.innerHTML='<span class="ac-pill ok">conectado</span>'+(s.conectado_em?' <span class="ac-muted">desde '+_acEsc(new Date(s.conectado_em).toLocaleDateString('pt-BR'))+'</span>':'');if(mg)mg.style.display='';}
    else{el.innerHTML='<span class="ac-pill neutral">não conectado</span>';if(mg)mg.style.display='none';}
  }catch(e){el.innerHTML='<span class="ac-muted">status indisponível</span>';if(mg)mg.style.display='none';}
}
async function _acConectarOneDrive(){
  try{const r=await _acProxy('microsoft.authUrl');if(r&&r.url)window.location.href=r.url;else adminToast('Falha ao iniciar conexão',false);}
  catch(e){adminToast('Erro: '+e.message,false);}
}
let _acODStack=[];
function _acOpenOneDrive(){_acTab='onedrive';_acSel=null;_acSelSetor=null;_acSelOrg=null;_acRender();}
async function _acRenderOneDrive(){
  const body=document.getElementById('ac-body');
  body.innerHTML=`
    <button class="ac-btn ghost" onclick="_acSetTab('config')">← Configurações</button>
    <div class="ac-section-h" style="margin-top:12px"><h3>Pastas do OneDrive sob controle</h3>
      <button class="ac-btn" style="margin-left:auto" onclick="_acODPicker()">+ Adicionar pasta</button></div>
    <div id="ac-od-list"><div class="ac-muted">Carregando…</div></div>`;
  _acODLoadFolders();
}
async function _acODLoadFolders(){
  const wrap=document.getElementById('ac-od-list');if(!wrap)return;
  let r;try{r=await _acProxy('microsoft.folders');}catch(e){wrap.innerHTML='<div class="ac-card">Erro: '+_acEsc(e.message)+'</div>';return;}
  const fs=(r&&r.folders)||[];
  wrap.innerHTML=fs.length?fs.map(f=>`
    <div class="ac-card">
      <div class="ac-section-h" style="border:none;margin:0;padding:0">
        <div class="grow"><div><strong>${_acEsc(f.nome)}</strong></div>${f.caminho?`<div class="ac-muted">${_acEsc(f.caminho)}</div>`:''}</div>
        <button class="ac-btn ghost" onclick="_acODToggleShares('${f.id}','${encodeURIComponent(f.external_id)}')">Compartilhamento</button>
        <button class="ac-btn ghost" data-odsub="1" data-extid="${_acEsc(f.external_id)}" data-name="${_acEsc(f.nome)}">Subpastas</button>
        <button class="ac-btn danger" onclick="_acODRemoveFolder('${f.id}')">Remover</button>
      </div>
      <div id="ac-od-sh-${f.id}" style="margin-top:10px;display:none"></div>
    </div>`).join(''):'<div class="ac-muted">Nenhuma pasta sob controle ainda. Clique em "+ Adicionar pasta".</div>';
  wrap.querySelectorAll('button[data-odsub]').forEach(b=>b.addEventListener('click',()=>_acODPicker(b.dataset.extid,b.dataset.name)));
}
async function _acODRemoveFolder(recursoId){
  if(!confirm('Tirar esta pasta da lista de controle? (não apaga a pasta no OneDrive — só para de gerenciá-la aqui)'))return;
  try{await _acProxy('microsoft.removeFolder',{recursoId});adminToast('Pasta removida do controle');_acODLoadFolders();}
  catch(e){adminToast('Erro: '+e.message,false);}
}
async function _acODToggleShares(recursoId,encItemId){
  const el=document.getElementById('ac-od-sh-'+recursoId);if(!el)return;
  if(el.style.display!=='none'){el.style.display='none';el.innerHTML='';return;}
  el.style.display='';await _acODShares(recursoId,encItemId);
}
async function _acODShares(recursoId,encItemId){
  const el=document.getElementById('ac-od-sh-'+recursoId);if(!el)return;
  const itemId=decodeURIComponent(encItemId);
  el.innerHTML='<div class="ac-muted">Carregando acessos…</div>';
  let r;try{r=await _acProxy('microsoft.shares',{itemId});}catch(e){el.innerHTML='<div class="ac-muted">Erro: '+_acEsc(e.message)+'</div>';return;}
  const sh=(r&&r.shares)||[];
  el.innerHTML=`
    <div class="ac-kicker">Quem tem acesso</div>
    ${sh.length?sh.map(s=>`<div class="ac-row"><div class="grow">${_acEsc(s.name||s.email||'—')}${(s.email&&s.name)?' <span class="ac-muted">'+_acEsc(s.email)+'</span>':''} <span class="ac-pill ${s.role==='edição'?'warn':'ok'}">${_acEsc(s.role)}</span></div><button class="ac-btn danger" onclick="_acODUnshare('${recursoId}','${encItemId}','${encodeURIComponent(s.permId)}')">Remover</button></div>`).join(''):'<div class="ac-muted">Ninguém além do dono.</div>'}
    <div class="ac-row" style="margin-top:8px">
      <select class="ac-select" id="ac-od-cl-${recursoId}" style="width:auto" onchange="_acODPickColab('${recursoId}',this.value)"><option value="">— puxar colaborador —</option>${(_acData.pessoas||[]).filter(p=>p.status==='ativo').map(p=>`<option value="${p.id}">${_acEsc(p.nome)}</option>`).join('')}</select>
      <input class="ac-input" id="ac-od-em-${recursoId}" placeholder="e-mail para dar acesso" style="flex:1;min-width:160px">
      <select class="ac-select" id="ac-od-rl-${recursoId}" style="width:auto"><option value="leitura">Leitura</option><option value="edição">Edição</option></select>
      <button class="ac-btn" onclick="_acODShare('${recursoId}','${encItemId}')">Compartilhar</button>
    </div>`;
}
function _acODPickColab(recursoId,pessoaId){
  if(!pessoaId)return;
  const c=(_acData.pessoas||[]).find(x=>x.id===pessoaId);if(!c)return;
  const inp=document.getElementById('ac-od-em-'+recursoId);
  if(!c.email_outlook){adminToast((c.nome||'Colaborador')+' não tem e-mail Outlook cadastrado',false);return;}
  if(inp)inp.value=c.email_outlook;
}
async function _acODShare(recursoId,encItemId){
  const email=(document.getElementById('ac-od-em-'+recursoId)||{}).value?.trim();
  const role=(document.getElementById('ac-od-rl-'+recursoId)||{}).value;
  if(!email){adminToast('Informe o e-mail',false);return;}
  try{const r=await _acProxy('microsoft.share',{itemId:decodeURIComponent(encItemId),email,role});
    if(r&&r.error){adminToast('Erro: '+_acEsc(r.detalhe||r.error),false);return;}
    adminToast('Compartilhado');_acODShares(recursoId,encItemId);
  }catch(e){adminToast('Erro: '+e.message,false);}
}
async function _acODUnshare(recursoId,encItemId,encPermId){
  if(!confirm('Remover este acesso?'))return;
  try{const r=await _acProxy('microsoft.unshare',{itemId:decodeURIComponent(encItemId),permId:decodeURIComponent(encPermId)});
    if(r&&r.error){adminToast('Erro: '+_acEsc(r.detalhe||r.error),false);return;}
    adminToast('Acesso removido');_acODShares(recursoId,encItemId);
  }catch(e){adminToast('Erro: '+e.message,false);}
}
// ---- picker (navega a árvore e marca) ----
async function _acODPicker(startId,startName){
  _acODStack = startId ? [{ id: startId, name: startName || 'pasta' }] : [];
  let ov=document.getElementById('ac-od-pick');if(ov)ov.remove();
  ov=document.createElement('div');ov.className='ac-modal-ov open';ov.id='ac-od-pick';
  ov.innerHTML=`<div class="ac-modal" style="max-width:640px">
    <div class="ac-section-h" style="border:none;margin:0 0 8px"><h3>Adicionar pasta</h3>
      <button class="ac-btn ghost" style="margin-left:auto" id="ac-od-pick-x">Fechar</button></div>
    <div id="ac-od-bc" class="ac-kicker" style="margin-bottom:10px"></div>
    <div id="ac-od-pick-body"><div class="ac-muted">Carregando…</div></div></div>`;
  (document.getElementById('acessos-screen')||document.body).appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
  ov.querySelector('#ac-od-pick-x').onclick=()=>ov.remove();
  _acODBrowse();
}
async function _acODBrowse(){
  const body=document.getElementById('ac-od-pick-body');const bc=document.getElementById('ac-od-bc');if(!body)return;
  const cur=_acODStack[_acODStack.length-1]||null;
  bc.textContent='OneDrive'+_acODStack.map(s=>' / '+s.name).join('');
  body.innerHTML='<div class="ac-muted">Carregando…</div>';
  let r;try{r=await _acProxy('microsoft.browse',cur?{itemId:cur.id}:{});}catch(e){body.innerHTML='<div class="ac-muted">Erro: '+_acEsc(e.message)+'</div>';return;}
  const fs=(r&&r.folders)||[];
  body.innerHTML=`
    ${cur?`<div style="margin-bottom:8px;display:flex;gap:8px;flex-wrap:wrap"><button class="ac-btn ghost" data-od="up">↑ Voltar</button><button class="ac-btn" data-od="add" data-id="${_acEsc(cur.id)}" data-name="${_acEsc(cur.name)}">+ Adicionar "${_acEsc(cur.name)}"</button></div>`:''}
    ${fs.length?fs.map(f=>`<div class="ac-row"><div class="grow">📁 ${_acEsc(f.name)}${f.childCount?' <span class="ac-muted">'+f.childCount+' itens</span>':''}</div>
      <button class="ac-btn ghost" data-od="open" data-id="${_acEsc(f.id)}" data-name="${_acEsc(f.name)}">Abrir</button>
      <button class="ac-btn" data-od="add" data-id="${_acEsc(f.id)}" data-name="${_acEsc(f.name)}">Adicionar</button></div>`).join(''):'<div class="ac-muted">Sem subpastas aqui.</div>'}`;
  body.querySelectorAll('button[data-od]').forEach(b=>{
    const act=b.dataset.od;
    b.addEventListener('click',()=>{
      if(act==='up')return _acODUp();
      if(act==='open')return _acODOpen(b.dataset.id,b.dataset.name);
      if(act==='add')return _acODAdd(b.dataset.id,b.dataset.name);
    });
  });
}
function _acODOpen(id,name){_acODStack.push({id,name});_acODBrowse();}
function _acODUp(){_acODStack.pop();_acODBrowse();}
async function _acODAdd(id,name){
  const caminho='OneDrive'+_acODStack.map(s=>'/'+s.name).join('')+(_acODStack.length&&_acODStack[_acODStack.length-1].id===id?'':'/'+name);
  try{await _acProxy('microsoft.addFolder',{itemId:id,name,caminho});
    adminToast('Pasta adicionada ao controle');
    const ov=document.getElementById('ac-od-pick');if(ov)ov.remove();
    _acODLoadFolders();
  }catch(e){adminToast('Erro: '+e.message,false);}
}
function _acOpenICloud(){_acTab='icloud';_acSel=null;_acSelSetor=null;_acSelOrg=null;_acRender();}
async function _acRenderICloud(){
  const body=document.getElementById('ac-body');
  body.innerHTML=`
    <button class="ac-btn ghost" onclick="_acSetTab('config')">← Configurações</button>
    <div class="ac-card" style="margin-top:12px"><span class="ac-kicker">${_acLogo('apple')}iCloud — manual</span> <span class="ac-muted">A Apple não tem API. Aqui você controla quem DEVE ter acesso; o compartilhamento real é feito por você no iCloud, e você marca "feito".</span></div>
    <div class="ac-section-h"><h3>Pastas do iCloud</h3><button class="ac-btn" style="margin-left:auto" onclick="_acICAddFolder()">+ Adicionar pasta</button></div>
    <div id="ac-ic-list"><div class="ac-muted">Carregando…</div></div>`;
  _acICLoadFolders();
}
async function _acICLoadFolders(){
  const wrap=document.getElementById('ac-ic-list');if(!wrap)return;
  // arquivado_em nulo = pasta ativa. Pasta arquivada não aparece na tela (a
  // linha continua no banco, só sai de vista — dá pra desarquivar pelo banco).
  const{data,error}=await sbClient.from('acessos_recursos').select('*').eq('tipo','icloud').is('arquivado_em',null).order('nome');
  if(error){wrap.innerHTML='<div class="ac-card">Erro: '+_acEsc(error.message)+'</div>';return;}
  const fs=data||[];
  wrap.innerHTML=fs.length?fs.map(f=>`
    <div class="ac-card">
      <div class="ac-section-h" style="border:none;margin:0;padding:0">
        <div class="grow"><strong>${_acEsc(f.nome)}</strong></div>
        <button class="ac-btn ghost" onclick="_acICToggleAcessos('${f.id}')">Acessos</button>
        <button class="ac-btn danger" onclick="_acICRemoveFolder('${f.id}')">Remover</button>
      </div>
      <div id="ac-ic-ac-${f.id}" style="margin-top:10px;display:none"></div>
    </div>`).join(''):'<div class="ac-muted">Nenhuma pasta do iCloud ainda. Clique em "+ Adicionar pasta".</div>';
}
async function _acICAddFolder(){
  const nome=prompt('Nome da pasta do iCloud:');if(!nome||!nome.trim())return;
  const{error}=await sbClient.from('acessos_recursos').insert({tipo:'icloud',provedor:'apple',nome:nome.trim()});
  if(error){adminToast('Erro: '+error.message,false);return;}
  await _acLog('icloud.pasta.criar','pasta:'+nome.trim(),'ok',null);adminToast('Pasta adicionada');_acICLoadFolders();
}
async function _acICRemoveFolder(id){
  if(!confirm('Remover esta pasta do iCloud e seus acessos registrados? (não mexe no iCloud em si)'))return;
  const{error}=await sbClient.from('acessos_recursos').delete().eq('id',id);
  if(error){adminToast('Erro: '+error.message,false);return;}
  await _acLog('icloud.pasta.excluir','pasta:'+id,'ok',null);adminToast('Pasta removida');_acICLoadFolders();
}
async function _acICToggleAcessos(recursoId){
  const el=document.getElementById('ac-ic-ac-'+recursoId);if(!el)return;
  if(el.style.display!=='none'){el.style.display='none';el.innerHTML='';return;}
  el.style.display='';await _acICAcessos(recursoId);
}
async function _acICAcessos(recursoId){
  const el=document.getElementById('ac-ic-ac-'+recursoId);if(!el)return;
  el.innerHTML='<div class="ac-muted">Carregando…</div>';
  const{data,error}=await sbClient.from('acessos_vinculos').select('*').eq('recurso_id',recursoId).order('criado_em');
  if(error){el.innerHTML='<div class="ac-muted">Erro: '+_acEsc(error.message)+'</div>';return;}
  const vs=data||[];
  const pOf=pid=>(_acData.pessoas||[]).find(x=>x.id===pid)||{};
  el.innerHTML=`
    <div class="ac-kicker">Quem deve ter acesso</div>
    ${vs.length?vs.map(v=>{const p=pOf(v.pessoa_id);return `<div class="ac-row"><div class="grow">${_acEsc(p.nome||'?')} ${p.conta_apple?('<span class="ac-muted">'+_acLogo('apple')+_acEsc(p.conta_apple)+'</span>'):'<span class="ac-pill bad">sem conta Apple</span>'} <span class="ac-pill ${v.papel==='edicao'?'warn':'ok'}">${v.papel==='edicao'?'edição':'leitura'}</span></div>
      <button class="ac-btn ${v.estado==='feito'?'':'ghost'}" onclick="_acICToggleFeito('${v.id}','${recursoId}',${v.estado==='feito'?'false':'true'})">${v.estado==='feito'?'✓ feito':'marcar feito'}</button>
      <button class="ac-btn danger" onclick="_acICRemoveAcesso('${v.id}','${recursoId}')">Remover</button></div>`;}).join(''):'<div class="ac-muted">Ninguém ainda.</div>'}
    <div class="ac-row" style="margin-top:8px">
      <select class="ac-select" id="ac-ic-cl-${recursoId}" style="flex:1;min-width:160px"><option value="">— colaborador —</option>${(_acData.pessoas||[]).filter(p=>p.status==='ativo').map(p=>`<option value="${p.id}">${_acEsc(p.nome)}${p.conta_apple?'':' (sem Apple)'}</option>`).join('')}</select>
      <select class="ac-select" id="ac-ic-pp-${recursoId}" style="width:auto"><option value="leitura">Leitura</option><option value="edicao">Edição</option></select>
      <button class="ac-btn" onclick="_acICAddAcesso('${recursoId}')">Dar acesso</button>
    </div>`;
}
async function _acICAddAcesso(recursoId){
  const pid=(document.getElementById('ac-ic-cl-'+recursoId)||{}).value;
  const papel=(document.getElementById('ac-ic-pp-'+recursoId)||{}).value||'leitura';
  if(!pid){adminToast('Escolha o colaborador',false);return;}
  const{error}=await sbClient.from('acessos_vinculos').insert({recurso_id:recursoId,pessoa_id:pid,papel,estado:'pendente'});
  if(error){adminToast('Erro: '+error.message,false);return;}
  await _acLog('icloud.acesso.criar','vinculo','ok',papel);adminToast('Acesso registrado (pendente)');_acICAcessos(recursoId);
}
async function _acICToggleFeito(vinculoId,recursoId,feito){
  const upd=feito?{estado:'feito',feito_em:new Date().toISOString()}:{estado:'pendente',feito_em:null};
  const{error}=await sbClient.from('acessos_vinculos').update(upd).eq('id',vinculoId);
  if(error){adminToast('Erro: '+error.message,false);return;}
  await _acLog('icloud.acesso.estado','vinculo:'+vinculoId,'ok',feito?'feito':'pendente');_acICAcessos(recursoId);
}
async function _acICRemoveAcesso(vinculoId,recursoId){
  if(!confirm('Remover este acesso registrado?'))return;
  const{error}=await sbClient.from('acessos_vinculos').delete().eq('id',vinculoId);
  if(error){adminToast('Erro: '+error.message,false);return;}
  await _acLog('icloud.acesso.excluir','vinculo:'+vinculoId,'ok',null);_acICAcessos(recursoId);
}
async function _acImportarZoho(){
  if(!confirm('Importar os usuários do Zoho como colaboradores? (cria os novos e atualiza os já importados)'))return;
  adminToast('Importando do Zoho…');
  try{const r=await _acProxy('zoho.import');
    adminToast('Importação: '+(r.criados||0)+' novos, '+(r.atualizados||0)+' atualizados'+(r.com_foto!=null?(', '+r.com_foto+' c/ foto'):''));
    await loadAcessos();
  }catch(e){adminToast('Erro: '+e.message,false);}
}
function _acHandleZohoReturn(){
  const p=new URLSearchParams(location.search);
  const z=p.get('zoho'); const o=p.get('onedrive');
  if(z){ if(z==='ok')adminToast('Zoho conectado!'); else adminToast('Falha ao conectar Zoho: '+(p.get('msg')||'erro'),false); }
  if(o){ if(o==='ok')adminToast('OneDrive conectado!'); else adminToast('Falha ao conectar OneDrive: '+(p.get('msg')||'erro'),false); } // ?onedrive=ok|erro
  if(z||o){ const u=new URL(location.href); u.searchParams.delete('zoho'); u.searchParams.delete('onedrive'); u.searchParams.delete('msg'); history.replaceState({},'',u.pathname+u.search+u.hash); }
}
if(document.readyState!=='loading')_acHandleZohoReturn();else window.addEventListener('DOMContentLoaded',_acHandleZohoReturn);
function _acSetTab(t){_acTab=t;_acSel=null;_acSelSetor=null;_acSelOrg=null;_acRender();}
// Zera a seleção (pessoa/setor/org) e re-renderiza. Existe porque os botões "voltar"
// são onclick inline (escopo global) e não podem atribuir direto às variáveis do módulo.
function _acVoltarSel(nivel){if(nivel==='org')_acSelOrg=null;else if(nivel==='setor')_acSelSetor=null;else _acSel=null;_acRender();}
/* ===== Fase 2: aba Drive ===== */
let _acDriveMarcas=[],_acDriveSel=null,_acDriveStack=[],_acDriveTree=[],_acDriveTreeTrunc=false,_acDriveCustomSecs=[],_acDriveOverrides={};
const _AC_SECTORS=[
  {key:'financeiro',label:'Financeiro',kw:['financ','dre','fluxo','caixa','cobran','contas a','tesour','boleto']},
  {key:'contabil',label:'Contabilidade & Fiscal',kw:['contab','fiscal','tribut','imposto','obrigac','societ']},
  {key:'rh',label:'RH & DP',kw:['rh','dp','recursos humanos','depart','pessoal','folha','funcion','colaborad']},
  {key:'marketing',label:'Marketing',kw:['marketing','mkt','artes','design','social','midia','campanha','trafego','branding','marca','identidade','visual','conteudo','video','foto','criativ','post']},
  {key:'comercial',label:'Comercial & Contratos',kw:['comercial','vendas','contrato','clientes','cliente','propost','crm']},
  {key:'suprimentos',label:'Suprimentos & Estoque',kw:['estoque','suprim','almoxar','compras','insumo','materiais','material','expedic','inventario']},
  {key:'juridico',label:'Jurídico',kw:['juridic','legal','process','advog']},
  {key:'operacoes',label:'Operações & Documentos',kw:['operac','logist','frota','doc','documento','acompanh','semanal','moto','produc']},
  {key:'diretoria',label:'Diretoria',kw:['diretor','institu','planejamento','estrateg']}
];
function _acDriveClassify(name){
  const n=String(name||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/^\s*\d+[.\-)\s]*/,'').trim();
  for(const s of _AC_SECTORS){if(s.kw.some(k=>n.includes(k)))return s;}
  return {key:'outros',label:'Outros'};
}
// Qual provedor a aba Drive está mostrando. A empresa está saindo do OneDrive
// pro Zoho WorkDrive, então os dois convivem aqui até o OneDrive ser arquivado.
let _acDriveProvedor='onedrive'; // 'onedrive' | 'workdrive'
function _acDriveSetProvedor(p){if(p===_acDriveProvedor)return;_acDriveProvedor=p;_acRenderDrive();}
// Barra que troca de provedor. Fica no topo dos DOIS lados, pra o caminho de
// volta existir sempre.
function _acDriveProvedorBar(){
  return `<div class="ac-driveviews">
    <button class="ac-tab ${_acDriveProvedor==='onedrive'?'active':''}" onclick="_acDriveSetProvedor('onedrive')">${_acLogo('ms')}OneDrive</button>
    <button class="ac-tab ${_acDriveProvedor==='workdrive'?'active':''}" onclick="_acDriveSetProvedor('workdrive')">${_acLogo('zoho')}Zoho WorkDrive</button>
  </div>`;
}
/* ===== Zoho WorkDrive (dentro da aba Drive) ===== */
// Pastas do WorkDrive já importadas, como vieram do banco (lista achatada).
let _acWdPastas=[];
// Quais ramos estão fechados. Ausente = aberto (começa tudo aberto: são poucas
// pastas e o dono quer bater o olho e ver a estrutura inteira).
let _acWdAberto={};
async function _acRenderWorkdrive(){
  const body=document.getElementById('ac-body');
  body.innerHTML=_acDriveProvedorBar()+`
    <div class="ac-hero">
      <div><h2>Zoho WorkDrive</h2><div class="ac-sub">As pastas do WorkDrive sob controle, na mesma hierarquia que elas têm no Zoho. É pra cá que a empresa está migrando.</div></div>
      <div class="ac-hero-actions"><button class="ac-btn ghost lg" id="ac-wd-importar" onclick="_acWdImportar()">Buscar pastas novas</button></div>
    </div>
    <div id="ac-wd-content"><div class="ac-muted">Carregando pastas…</div></div>`;
  _acWdCarregarPastas();
}
async function _acWdCarregarPastas(){
  const cont=document.getElementById('ac-wd-content');if(!cont)return;
  // Lê DIRETO do banco (e não pelo proxy): a tela só quer mostrar o que já foi
  // importado. Passar pelo Zoho a cada abertura deixaria a tela lenta e a
  // deixaria refém da API estar no ar. Buscar no Zoho é só no botão.
  const{data,error}=await sbClient.from('acessos_recursos').select('*').eq('tipo','workdrive').is('arquivado_em',null).order('caminho');
  if(error){cont.innerHTML='<div class="ac-card">Erro ao ler as pastas: '+_acEsc(error.message)+'</div>';return;}
  _acWdPastas=data||[];
  _acWdRepaint();
}
function _acWdRepaint(){
  const cont=document.getElementById('ac-wd-content');if(!cont)return;
  if(!_acWdPastas.length){cont.innerHTML='<div class="ac-empty">Nenhuma pasta do WorkDrive por aqui ainda. Clique em "Buscar pastas novas" para trazer as pastas do Zoho.</div>';return;}
  // A hierarquia não vem pronta do banco: ela está escondida no texto do campo
  // `caminho` ("mãe/filha"). Quem desdobra isso em árvore é o módulo testado.
  const raizes=montarArvoreDePastas(_acWdPastas);
  // O invólucro com rolagem própria existe pro celular: um ramo fundo é largo,
  // e sem ele a árvore empurraria a PÁGINA inteira pro lado. Assim quem rola é
  // só a árvore.
  cont.innerHTML=`<div class="ac-muted" style="font-size:11px;margin:0 0 12px">${_acWdPastas.length} pasta(s) sob controle. Clique no <b>▸</b> para abrir ou fechar um ramo.</div>
    <div class="ac-wd-arvore"><ul class="ac-tree ac-tree-root">${raizes.map(_acWdNo).join('')}</ul></div>`;
}
// Desenha uma pasta e, embaixo dela, as filhas — chamando a si mesma. É a
// recursão que dá o aninhamento; a indentação em si é do CSS (.ac-tree).
function _acWdNo(no){
  const temFilhas=no.filhas.length>0;
  const aberto=_acWdAberto[no.id]!==false;
  return `<li class="ac-tnode">
    <div class="ac-tn-row">
      ${temFilhas?`<button class="ac-tn-tog ${aberto?'open':''}" onclick="_acWdAlternar('${_acEsc(no.id)}')" title="${aberto?'recolher':'expandir'}">▸</button>`:'<span class="ac-tn-dot"></span>'}
      <div class="ac-vcard ${no.nivel===0?'ac-vcard-root':''}" style="--sc:#e1251b">
        <span class="ac-vc-ico">${no.nivel===0?'🏢':'📁'}</span>
        <span class="ac-vc-name" title="${_acEsc(no.caminho)}">${_acEsc(no.nome)}</span>
        ${temFilhas?`<span class="ac-vc-count">${no.filhas.length}</span>`:''}
      </div>
    </div>
    ${temFilhas&&aberto?`<ul class="ac-tree">${no.filhas.map(_acWdNo).join('')}</ul>`:''}
  </li>`;
}
function _acWdAlternar(id){_acWdAberto[id]=(_acWdAberto[id]===false);_acWdRepaint();}
async function _acWdImportar(){
  const b=document.getElementById('ac-wd-importar');
  if(b){b.disabled=true;b.textContent='Buscando…';}
  try{
    // Sem parâmetro nenhum de propósito: a ação importa tudo que for novo e é
    // idempotente — clicar duas vezes não duplica pasta (a chave é o
    // external_id, e o banco tem índice único garantindo isso).
    const r=await _acProxy('zoho.importarPastas');
    const criadas=(r&&r.criadas)||0;
    adminToast(criadas?(criadas+' pasta(s) nova(s) importada(s)'):'Nenhuma pasta nova — já estava tudo aqui');
    await _acWdCarregarPastas();
  }catch(e){
    // "nao_conectado" é o caso comum e tem conserto claro; o resto é erro mesmo.
    adminToast(e.message==='nao_conectado'?'Conecte o Zoho em Configurações antes de importar':('Erro ao importar: '+e.message),false);
  }finally{
    const b2=document.getElementById('ac-wd-importar');
    if(b2){b2.disabled=false;b2.textContent='Buscar pastas novas';}
  }
}
async function _acRenderDrive(){
  if(_acDriveProvedor==='workdrive')return _acRenderWorkdrive();
  const body=document.getElementById('ac-body');
  body.innerHTML='<div class="ac-muted">Carregando Drive…</div>';
  try{const{data}=await sbClient.from('acessos_drive_marcas').select('*').order('ordem').order('nome');_acDriveMarcas=data||[];}catch(e){_acDriveMarcas=[];}
  try{const{data:cs}=await sbClient.from('acessos_drive_setores').select('*').order('ordem').order('label');_acDriveCustomSecs=cs||[];}catch(e){_acDriveCustomSecs=[];}
  try{const{data:ov}=await sbClient.from('acessos_drive_overrides').select('external_id,setor_chave');_acDriveOverrides={};(ov||[]).forEach(o=>{_acDriveOverrides[o.external_id]=o.setor_chave;});}catch(e){_acDriveOverrides={};}
  if((!_acDriveSel||!_acDriveMarcas.find(m=>m.id===_acDriveSel))&&_acDriveMarcas.length)_acDriveSel=_acDriveMarcas[0].id;
  _acDrivePaintShell();
  if(_acDriveMarcas.length)_acDriveExplode();
}
function _acDrivePaintShell(){
  const body=document.getElementById('ac-body');
  const chips=_acDriveMarcas.map(m=>`<button class="ac-brand-chip ${m.id===_acDriveSel?'active':''}" onclick="_acDriveSelectMarca('${m.id}')">${_acEsc(m.nome)}<span class="ac-brand-x" title="remover marca" onclick="event.stopPropagation();_acDriveDelMarca('${m.id}')">✕</span></button>`).join('');
  body.innerHTML=_acDriveProvedorBar()+`
    <div class="ac-hero">
      <div><h2>Drive</h2><div class="ac-sub">Pastas das marcas agrupadas por setor. Compartilhe direto daqui, com vários colaboradores de uma vez.</div></div>
      <div class="ac-hero-actions"><button class="ac-btn ghost lg" onclick="_acDriveAddMarca()">+ Adicionar marca</button></div>
    </div>
    ${_acDriveMarcas.length?`<div class="ac-brand-bar">${chips}</div>`:''}
    <div id="ac-drive-content">${_acDriveMarcas.length?'<div class="ac-muted">Carregando pastas…</div>':'<div class="ac-empty">Nenhuma marca ainda. Clique em "+ Adicionar marca" e escolha uma pasta-raiz (ex.: 21. RBV & Company).</div>'}</div>`;
}
let _acDriveDepth=2,_acDriveSecOpen={},_acDriveDragId=null,_acDriveView='setor',_acDriveFlowOpen={};
function _acDriveSecColor(key){
  const m={financeiro:'#16a34a',contabil:'#0891b2',rh:'#7c3aed',marketing:'#db2777',comercial:'#ea580c',suprimentos:'#ca8a04',juridico:'#64748b',operacoes:'#0d9488',diretoria:'#9333ea',outros:'#94a3b8'};
  if(m[key])return m[key];
  let h=0;for(let i=0;i<key.length;i++)h=(h*31+key.charCodeAt(i))%360;return 'hsl('+h+',55%,46%)';
}
function _acDriveLegend(){
  const secs=_acDriveAllSectors();
  const used=secs.filter(s=>_acDriveTree.some(f=>_acDriveSectorOf(f).key===s.key));
  if(!used.length)return '';
  return `<div class="ac-legend">${used.map(s=>{const c=_acDriveSecColor(s.key),cnt=_acDriveTree.filter(f=>_acDriveSectorOf(f).key===s.key).length;return `<span class="ac-leg"><span class="ac-leg-dot" style="background:${c}"></span>${_acEsc(s.label)} <span class="ac-muted">(${cnt})</span><button class="ac-leg-go" data-lib="${_acEsc(s.key)}">Liberar setor</button></span>`;}).join('')}</div>`;
}
function _acDriveRenderFlow(){
  const marca=_acDriveMarcas.find(m=>m.id===_acDriveSel);
  const roots=_acDriveBuildTree();
  const brandT={node:{id:'__brand__',name:marca?marca.nome:'Marca'},children:roots,_brand:true};
  return `<ul class="ac-tree ac-tree-root">${_acDriveFlowNode(brandT)}</ul>`;
}
function _acDriveFlowNode(t){
  const n=t.node,hasKids=t.children&&t.children.length;
  if(t._brand){
    return `<li class="ac-tnode"><div class="ac-tn-row"><span class="ac-tn-dot"></span><div class="ac-vcard ac-vcard-root"><span class="ac-vc-ico">🏠</span><span class="ac-vc-name">${_acEsc(n.name)}</span><span class="ac-vc-sec" style="color:#0d9488">marca</span></div></div>${hasKids?`<ul class="ac-tree">${t.children.map(_acDriveFlowNode).join('')}</ul>`:''}</li>`;
  }
  const sec=_acDriveSectorOf(n),col=_acDriveSecColor(sec.key),open=_acDriveFlowOpen[n.id]===true;
  return `<li class="ac-tnode">
    <div class="ac-tn-row">
      ${hasKids?`<button class="ac-tn-tog ${open?'open':''}" data-ftog="${_acEsc(n.id)}" title="${open?'recolher':'expandir'}">▸</button>`:'<span class="ac-tn-dot"></span>'}
      <div class="ac-vcard" style="--sc:${col}">
        <span class="ac-vc-ico">📁</span>
        <span class="ac-vc-name" title="${_acEsc(n.name)}">${_acEsc(n.name)}</span>
        <span class="ac-vc-sec" style="color:${col}">${_acEsc(sec.label)}</span>
        ${hasKids?`<span class="ac-vc-count">${t.children.length}</span>`:''}
        <button class="ac-vc-share" data-drv="share" data-id="${_acEsc(n.id)}" data-name="${_acEsc(n.name)}" title="Compartilhar esta pasta">⤴</button>
      </div>
    </div>
    ${hasKids&&open?`<ul class="ac-tree">${t.children.map(_acDriveFlowNode).join('')}</ul>`:''}
  </li>`;
}
function _acDriveFlowTog(id){_acDriveFlowOpen[id]=!_acDriveFlowOpen[id];_acDriveRepaint();}
// Seletor de colaboradores AGRUPADO POR SETOR + busca (reusado nos modais de compartilhar).
function _acColabPicker(cbClass){
  const D=_acData||{};
  const ativos=(D.pessoas||[]).filter(p=>p&&p.status==='ativo'&&p.email_outlook);
  if(!ativos.length)return '<div class="ac-muted" style="padding:10px">Nenhum colaborador ativo com e-mail Outlook.</div>';
  const groups={};
  ativos.forEach(p=>{const s=p.setor_id?(((D.setores||[]).find(x=>x.id===p.setor_id))||{}).nome:null;const key=s||'Sem setor';(groups[key]=groups[key]||[]).push(p);});
  const order=Object.keys(groups).sort((a,b)=>a==='Sem setor'?1:(b==='Sem setor'?-1:a.localeCompare(b)));
  return `<div class="ac-pickwrap">
    <input class="ac-input ac-pick-search" placeholder="🔎 buscar colaborador…" oninput="_acPickFilter(this)">
    <div class="ac-pick-list">
    ${order.map(g=>`<div class="ac-pick-grp">
      <div class="ac-pick-grp-h"><span>${_acEsc(g)} <span class="ac-muted" style="text-transform:none;letter-spacing:0">(${groups[g].length})</span></span><button type="button" class="ac-pick-all" onclick="_acPickAll(this,'${cbClass}')">todos</button></div>
      ${groups[g].map(p=>`<label class="ac-pick" data-name="${_acEsc((p.nome||'').toLowerCase()+' '+(p.cargo||'').toLowerCase())}"><input type="checkbox" class="${cbClass}" data-email="${_acEsc(p.email_outlook)}" onchange="_acPickCount(this)"> ${_acAvatar(p,32)} <span class="grow"><span class="ac-pick-name">${_acEsc(p.nome)}</span><span class="ac-pick-meta">${p.cargo?_acEsc(p.cargo)+' · ':''}${_acEsc(p.email_outlook)}</span></span></label>`).join('')}
    </div>`).join('')}
    </div></div>`;
}
function _acPickFilter(inp){
  const q=(inp.value||'').toLowerCase().trim();const wrap=inp.closest('.ac-pickwrap');if(!wrap)return;
  wrap.querySelectorAll('.ac-pick').forEach(l=>{l.style.display=(!q||(l.dataset.name||'').includes(q))?'':'none';});
  wrap.querySelectorAll('.ac-pick-grp').forEach(g=>{const any=[...g.querySelectorAll('.ac-pick')].some(l=>l.style.display!=='none');g.style.display=any?'':'none';});
}
function _acPickAll(btn,cbClass){
  const grp=btn.closest('.ac-pick-grp');if(!grp)return;
  const cbs=[...grp.querySelectorAll('input.'+cbClass)].filter(c=>c.closest('.ac-pick').style.display!=='none');
  const allOn=cbs.length&&cbs.every(c=>c.checked);cbs.forEach(c=>c.checked=!allOn);
  btn.textContent=allOn?'todos':'limpar';
  if(cbs[0])_acPickCount(cbs[0]);
}
function _acPickCount(el){
  const modal=el.closest('.ac-modal');if(!modal)return;
  const n=modal.querySelectorAll('.ac-pick-list input:checked').length;
  const c=modal.querySelector('.ac-pick-count');if(c){c.textContent=n+' selecionado'+(n===1?'':'s');c.classList.toggle('on',n>0);}
}
function _acDriveAllSectors(){return _AC_SECTORS.map(s=>({key:s.key,label:s.label})).concat(_acDriveCustomSecs.map(s=>({key:s.chave,label:s.label}))).concat([{key:'outros',label:'Outros'}]);}
function _acDriveLabelOf(key){const a=_acDriveAllSectors().find(s=>s.key===key);return a?a.label:'Outros';}
function _acDriveSelectMarca(id){_acDriveSel=id;_acDrivePaintShell();_acDriveExplode();}
function _acDriveSectorOf(f){
  if(_acDriveOverrides[f.id])return {key:_acDriveOverrides[f.id],label:_acDriveLabelOf(_acDriveOverrides[f.id])};
  let s=_acDriveClassify(f.name);
  if(s.key==='outros'&&Array.isArray(f.trail)){for(let i=f.trail.length-1;i>=0;i--){const a=_acDriveClassify(f.trail[i]);if(a.key!=='outros'){s=a;break;}}}
  return s;
}
function _acDriveFolderCard(f,secs){
  const path=(f.trail&&f.trail.length)?f.trail.join(' / '):'raiz da marca';
  const cur=_acDriveSectorOf(f).key;
  const opts=(secs||_acDriveAllSectors()).map(s=>`<option value="${s.key}" ${s.key===cur?'selected':''}>${_acEsc(s.label)}</option>`).join('');
  return `<div class="ac-folder" draggable="true" data-id="${_acEsc(f.id)}" ondragstart="_acDriveDragStart(event,'${_acEsc(f.id)}')" ondragend="_acDriveDragEnd(event)">
    <div class="ac-folder-top"><span class="ac-folder-ico" style="cursor:grab" title="arraste para outro setor">⠿ 📁</span><div class="grow" style="min-width:0"><div class="ac-folder-name">${_acEsc(f.name)}</div><div class="ac-folder-sub" title="${_acEsc(path)}">${_acEsc(path)}</div></div></div>
    <div class="ac-folder-actions">
      <select class="ac-select ac-move" title="mover para setor" onclick="event.stopPropagation()" onchange="_acDriveMove('${_acEsc(f.id)}',this.value)">${opts}</select>
      <button class="ac-btn" data-drv="share" data-id="${_acEsc(f.id)}" data-name="${_acEsc(f.name)}">Compartilhar</button>
    </div>
  </div>`;
}
function _acDriveWire(cont){
  cont.querySelectorAll('button[data-drv]').forEach(b=>{const a=b.dataset.drv;b.addEventListener('click',()=>{if(a==='share')_acDriveShare(b.dataset.id,b.dataset.name);});});
  cont.querySelectorAll('button[data-lib]').forEach(b=>b.addEventListener('click',()=>_acDriveLiberarSetor(b.dataset.lib)));
  cont.querySelectorAll('button[data-ftog]').forEach(b=>b.addEventListener('click',()=>_acDriveFlowTog(b.dataset.ftog)));
}
function _acDriveSetDepth(d){_acDriveDepth=d;_acDriveExplode();}
function _acDriveToggleSec(k){_acDriveSecOpen[k]=(_acDriveSecOpen[k]===false);const el=document.querySelector('#acessos-screen .ac-secbody[data-sec="'+k+'"]');if(el){el.style.display=_acDriveSecOpen[k]!==false?'':'none';const ch=el.parentElement.querySelector('.ac-secchev');if(ch)ch.classList.toggle('open',_acDriveSecOpen[k]!==false);}}
// drag & drop entre setores
function _acDriveDragStart(e,id){_acDriveDragId=id;try{e.dataTransfer.setData('text/plain',id);e.dataTransfer.effectAllowed='move';}catch(_){}if(e.currentTarget&&e.currentTarget.classList)e.currentTarget.classList.add('ac-dragging');}
function _acDriveDragEnd(e){if(e.currentTarget&&e.currentTarget.classList)e.currentTarget.classList.remove('ac-dragging');document.querySelectorAll('#acessos-screen .ac-secmod.ac-drop-on').forEach(el=>el.classList.remove('ac-drop-on'));_acDriveDragId=null;}
function _acDriveDragOver(e){e.preventDefault();if(e.dataTransfer)try{e.dataTransfer.dropEffect='move';}catch(_){}e.currentTarget.classList.add('ac-drop-on');}
function _acDriveDragLeave(e){if(e.currentTarget.contains&&e.relatedTarget&&e.currentTarget.contains(e.relatedTarget))return;e.currentTarget.classList.remove('ac-drop-on');}
function _acDriveDrop(e,key){e.preventDefault();e.currentTarget.classList.remove('ac-drop-on');const id=_acDriveDragId||(e.dataTransfer&&e.dataTransfer.getData('text/plain'));_acDriveDragId=null;if(id)_acDriveMove(id,key);}
async function _acDriveMove(extId,key){
  const f=_acDriveTree.find(x=>x.id===extId);
  _acDriveOverrides[extId]=key;
  try{await sbClient.from('acessos_drive_overrides').upsert({external_id:extId,setor_chave:key,nome:f?f.name:null,atualizado_em:new Date().toISOString()},{onConflict:'external_id'});}
  catch(e){adminToast('Erro ao salvar: '+e.message,false);}
  _acDriveRepaint();
}
async function _acDriveAddSetor(){
  const label=prompt('Nome do novo setor:');if(!label||!label.trim())return;
  const chave='c_'+label.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,28)+'_'+Math.floor(Math.random()*9000+1000);
  const ordem=(_acDriveCustomSecs.reduce((mx,s)=>Math.max(mx,s.ordem||0),100))+1;
  const{error}=await sbClient.from('acessos_drive_setores').insert({chave,label:label.trim(),ordem});
  if(error){adminToast('Erro: '+error.message,false);return;}
  await _acLog('drive.setor.add','setor:'+label.trim(),'ok',null);adminToast('Setor criado');
  try{const{data:cs}=await sbClient.from('acessos_drive_setores').select('*').order('ordem').order('label');_acDriveCustomSecs=cs||[];}catch(e){}
  _acDriveRepaint();
}
async function _acDriveDelSetor(chave){
  const s=_acDriveCustomSecs.find(x=>x.chave===chave);if(!s)return;
  if(!confirm('Remover o setor "'+s.label+'"? As pastas dele voltam à classificação automática.'))return;
  const{error}=await sbClient.from('acessos_drive_setores').delete().eq('chave',chave);
  if(error){adminToast('Erro: '+error.message,false);return;}
  try{await sbClient.from('acessos_drive_overrides').delete().eq('setor_chave',chave);}catch(e){}
  Object.keys(_acDriveOverrides).forEach(k=>{if(_acDriveOverrides[k]===chave)delete _acDriveOverrides[k];});
  _acDriveCustomSecs=_acDriveCustomSecs.filter(x=>x.chave!==chave);
  await _acLog('drive.setor.del','setor:'+s.label,'ok',null);adminToast('Setor removido');_acDriveRepaint();
}
async function _acDriveExplode(){
  const cont=document.getElementById('ac-drive-content');if(!cont)return;
  const marca=_acDriveMarcas.find(m=>m.id===_acDriveSel);if(!marca)return;
  cont.innerHTML='<div class="ac-muted">Explodindo as pastas da marca em todas as camadas… (pode levar alguns segundos)</div>';
  let r;try{r=await _acProxy('microsoft.tree',{itemId:marca.external_id,depth:_acDriveDepth});}catch(e){cont.innerHTML='<div class="ac-card">Erro ao varrer: '+_acEsc(e.message)+'</div>';return;}
  _acDriveTree=(r&&r.folders)||[];_acDriveTreeTrunc=!!(r&&r.truncated);
  _acDriveRepaint();
}
function _acDriveRepaint(){
  const cont=document.getElementById('ac-drive-content');if(!cont)return;
  const folders=_acDriveTree;
  const secs=_acDriveAllSectors();
  const marca=_acDriveMarcas.find(m=>m.id===_acDriveSel);
  const marcaBar=(marca&&marca.external_id)?`<div class="ac-drive-marcabar"><div class="grow"><span class="ac-drive-marca-nome">${_acEsc(marca.nome)}</span><span class="ac-muted" style="font-size:11px;display:block;margin-top:2px">Compartilhar a marca inteira dá acesso a TUDO dentro dela (a pessoa passa a ver toda a árvore).</span></div><button class="ac-btn primary" data-drv="share" data-id="${_acEsc(marca.external_id)}" data-name="${_acEsc(marca.nome)}">Compartilhar marca inteira</button></div>`:'';
  const viewToggle=`<div class="ac-driveviews"><button class="ac-tab ${_acDriveView==='setor'?'active':''}" onclick="_acDriveSetView('setor')">Por setor</button><button class="ac-tab ${_acDriveView==='arvore'?'active':''}" onclick="_acDriveSetView('arvore')">Árvore (fluxo)</button></div>`;
  const depthCtl=`<div class="ac-depth"><span class="ac-muted">Camadas:</span>${[1,2,3,4].map(d=>'<button class="ac-depth-b '+(d===_acDriveDepth?'active':'')+'" onclick="_acDriveSetDepth('+d+')">'+d+'</button>').join('')}${_acDriveView==='setor'?'<button class="ac-btn ghost" onclick="_acDriveAddSetor()">+ Novo setor</button>':''}<span class="ac-muted" style="margin-left:auto">${folders.length} pasta(s)${_acDriveTreeTrunc?' · limite atingido':''}</span></div>`;
  let bodyHtml;
  if(_acDriveView==='arvore'){
    bodyHtml=`<div class="ac-muted" style="font-size:11px;margin:0 0 12px">Fluxograma a partir da raiz da marca. Cores = setor. Clique no <b>▸</b> de um card para abrir o ramo; <b>⤴</b> compartilha a pasta; "Liberar setor" libera tudo do setor.</div>`+_acDriveLegend()+_acDriveRenderFlow();
  }else{
    const buckets={};
    folders.forEach(f=>{const s=_acDriveSectorOf(f);(buckets[s.key]=buckets[s.key]||{label:s.label,list:[]}).list.push(f);});
    Object.keys(buckets).forEach(k=>buckets[k].list.sort((a,b)=>a.name.localeCompare(b.name)));
    const mods=secs.filter(s=>buckets[s.key]).map(s=>{
      const b=buckets[s.key],open=_acDriveSecOpen[s.key]!==false,custom=_acDriveCustomSecs.some(c=>c.chave===s.key);
      return `<div class="ac-secmod" ondragover="_acDriveDragOver(event)" ondragleave="_acDriveDragLeave(event)" ondrop="_acDriveDrop(event,'${s.key}')">
        <div class="ac-secmod-h">
          <span style="display:flex;align-items:center;gap:10px;cursor:pointer" onclick="_acDriveToggleSec('${s.key}')"><span class="ac-secchev ${open?'open':''}">▸</span>${_acEsc(s.label)} <span class="ac-muted" style="text-transform:none;letter-spacing:0">(${b.list.length})</span></span>
          <span style="margin-left:auto;display:flex;gap:6px">
            <button class="ac-btn" data-lib="${_acEsc(s.key)}">Liberar setor</button>
            ${custom?`<button class="ac-btn ghost" title="remover setor" onclick="_acDriveDelSetor('${s.key}')">✕</button>`:''}
          </span>
        </div>
        <div class="ac-folder-grid ac-secbody" data-sec="${s.key}" style="${open?'':'display:none'}">${b.list.map(f=>_acDriveFolderCard(f,secs)).join('')}</div>
      </div>`;
    }).join('');
    bodyHtml=`<div class="ac-muted" style="font-size:11px;margin:0 0 14px">Arraste uma pasta para outro setor (ou use o seletor no card). "Liberar setor" compartilha todas as pastas do setor.</div>`+(mods||'<div class="ac-empty">Nenhuma pasta encontrada nesta marca.</div>');
  }
  cont.innerHTML=viewToggle+marcaBar+depthCtl+bodyHtml;
  _acDriveWire(cont);
}
function _acDriveSetView(v){_acDriveView=v;_acDriveRepaint();}
function _acDriveBuildTree(){
  const byId={};_acDriveTree.forEach(n=>{byId[n.id]={node:n,children:[]};});
  const roots=[];
  _acDriveTree.forEach(n=>{const p=n.parentId&&byId[n.parentId];if(p)p.children.push(byId[n.id]);else roots.push(byId[n.id]);});
  const sortRec=arr=>{arr.sort((a,b)=>a.node.name.localeCompare(b.node.name));arr.forEach(c=>sortRec(c.children));};
  sortRec(roots);
  return roots;
}
async function _acDriveLiberarSetor(key){
  const folders=_acDriveTree.filter(f=>_acDriveSectorOf(f).key===key);
  if(!folders.length){adminToast('Setor sem pastas',false);return;}
  const label=_acDriveLabelOf(key);
  const ov=document.createElement('div');ov.className='ac-modal-ov open';
  ov.innerHTML=`<div class="ac-modal ac-modal-lg">
    <div class="ac-modal-head"><div><h3 style="margin:0">Liberar setor — ${_acEsc(label)}</h3><div class="ac-muted" style="font-size:12px;margin-top:3px">Compartilha as <b>${folders.length}</b> pasta(s) deste setor</div></div><button class="ac-btn ghost" id="ac-lib-x">Fechar</button></div>
    <div class="ac-modal-body"><div id="ac-lib-has"><div class="ac-muted" style="font-size:12px;padding:0 0 12px">Carregando quem já tem acesso…</div></div><div class="ac-kicker" style="display:block;margin:0 0 6px">Adicionar colaboradores</div>${_acColabPicker('ac-lib-cb')}</div>
    <div class="ac-modal-foot">
      <span class="ac-pick-count">0 selecionados</span>
      <input class="ac-input" id="ac-lib-extra" placeholder="ou e-mail avulso" style="flex:1;min-width:120px">
      <select class="ac-select" id="ac-lib-role" style="width:auto"><option value="leitura">Leitura</option><option value="edição">Edição</option></select>
      <button class="ac-btn primary" id="ac-lib-go">Liberar ${folders.length} pasta(s)</button>
    </div>
  </div>`;
  (document.getElementById('acessos-screen')||document.body).appendChild(ov);const close=()=>ov.remove();
  ov.addEventListener('click',e=>{if(e.target===ov)close();});
  ov.querySelector('#ac-lib-x').onclick=close;
  // quem já tem acesso às pastas do setor (agregado) — consistente com o modal de pasta única
  (async()=>{const box=ov.querySelector('#ac-lib-has');if(!box)return;
    let sh=[];try{const r=await _acProxy('microsoft.sharesMany',{items:folders.map(f=>f.id)});sh=(r&&r.shares)||[];}catch(e){}
    if(!sh.length){box.innerHTML='<div class="ac-muted" style="font-size:12px;padding:0 0 12px">Ninguém tem acesso a estas pastas ainda.</div>';return;}
    box.innerHTML='<div class="ac-kicker" style="display:block;margin:0 0 6px">Quem já tem acesso <span class="ac-muted" style="text-transform:none;letter-spacing:0">('+folders.length+' pasta(s) no setor)</span></div><div style="margin-bottom:16px">'+sh.map(s=>'<div class="ac-row"><div class="grow">'+_acEsc(s.name||s.email||'—')+((s.email&&s.name)?' <span class="ac-muted">'+_acEsc(s.email)+'</span>':'')+' <span class="ac-pill '+(s.role==='edição'?'warn':'ok')+'">'+_acEsc(s.role)+'</span> <span class="ac-muted" style="font-size:11px">'+s.folders+'/'+folders.length+' pastas</span></div></div>').join('')+'</div>';
  })();
  ov.querySelector('#ac-lib-go').onclick=async()=>{
    const role=ov.querySelector('#ac-lib-role').value;
    const emails=[...ov.querySelectorAll('.ac-lib-cb:checked')].map(c=>c.dataset.email);
    const extra=ov.querySelector('#ac-lib-extra').value.trim();if(extra)emails.push(extra);
    if(!emails.length){adminToast('Selecione ao menos um colaborador ou informe um e-mail',false);return;}
    const btn=ov.querySelector('#ac-lib-go');btn.disabled=true;btn.textContent='Liberando…';
    let r;
    try{r=await _acProxy('microsoft.shareMany',{items:folders.map(f=>({id:f.id,name:f.name})),emails,role});
      await _acLog('drive.liberarSetor','setor:'+label,(r&&r.fail)?'parcial':'ok',((r&&r.ok)||0)+'/'+((r&&r.ops)||0));
    }catch(e){adminToast('Erro: '+e.message,false);btn.disabled=false;btn.textContent='Liberar';return;}
    // tela de resultado com os links das pastas (envio direto, sem depender do e-mail da Microsoft)
    const links=(r&&r.links)||[],okN=(r&&r.ok)||0;
    const mism=((r&&r.resolved)||[]).filter(x=>x.account&&x.account.toLowerCase()!==String(x.invited).toLowerCase());
    const fixes=await _acFixAliases(mism); // auto-corrige o cadastro p/ a conta real
    const modal=ov.querySelector('.ac-modal');
    modal.innerHTML=`
      <div class="ac-modal-head"><div><h3 style="margin:0">Setor liberado — ${_acEsc(label)}</h3><div class="ac-muted" style="font-size:12px;margin-top:3px">✓ ${okN} compartilhamento(s)${(r&&r.fail)?(' · '+r.fail+' falha(s)'):''}${(r&&r.truncated)?' (limite atingido)':''}</div></div><button class="ac-btn ghost" id="ac-lib-x2">Fechar</button></div>
      <div class="ac-modal-body">
        ${fixes.length?`<div class="ac-note ac-note-warn">✅ <b>Apelido corrigido automaticamente.</b> Estes e-mails eram alias; o acesso já caiu na <b>conta Microsoft real</b> e atualizei o cadastro pra ela (futuros compartilhamentos já miram a conta certa):<br>${fixes.map(f=>'• '+_acEsc(f.invited)+' → <b>'+_acEsc(f.account)+'</b>'+(f.nome?' — '+_acEsc(f.nome)+' atualizado':' — não cadastrado, avise pra acessar com essa conta')).join('<br>')}</div>`:''}
        <div class="ac-note">Acessos concedidos. <b>Envie os links abaixo ao colaborador</b> — é mais confiável que o e-mail automático da Microsoft (que pode cair em outro endereço ou no spam). Só quem foi convidado consegue abrir.</div>
        <div class="ac-linklist">${links.map(l=>`<div class="ac-row"><div class="grow" style="min-width:0"><b>${_acEsc(l.name||'(pasta)')}</b><div class="ac-linkurl">${l.link?_acEsc(l.link):'<span class="ac-muted">link indisponível</span>'}</div></div>${l.link?`<button class="ac-btn" data-copy1="${_acEsc(l.link)}">Copiar</button>`:''}</div>`).join('')||'<div class="ac-muted">Nenhum link disponível.</div>'}</div>
      </div>
      <div class="ac-modal-foot"><span class="ac-muted" style="font-size:11px">${emails.length} colaborador(es)</span><button class="ac-btn primary" id="ac-lib-copyall">Copiar todos os links</button></div>`;
    modal.querySelector('#ac-lib-x2').onclick=close;
    modal.querySelectorAll('button[data-copy1]').forEach(b=>b.onclick=()=>_acCopy(b.dataset.copy1,b));
    const allText='Acessos — '+label+' (RBV):\n'+links.filter(l=>l.link).map(l=>'• '+(l.name||'pasta')+': '+l.link).join('\n');
    {const ca=modal.querySelector('#ac-lib-copyall');if(ca)ca.onclick=()=>_acCopy(allText,ca);}
  };
}
async function _acDriveAddMarca(){
  let r;try{r=await _acProxy('microsoft.browse',{});}catch(e){adminToast('Erro: '+e.message,false);return;}
  const folders=(r&&r.folders)||[];
  const ov=document.createElement('div');ov.className='ac-modal-ov open';
  ov.innerHTML=`<div class="ac-modal" style="max-width:560px"><div class="ac-section-h" style="border:none"><h3 style="margin:0">Adicionar marca</h3><button class="ac-btn ghost" id="x" style="margin-left:auto">Fechar</button></div>
    <p class="ac-muted" style="margin:.2em 0 1em">Escolha a pasta-raiz da marca no seu OneDrive.</p>
    <div style="max-height:60vh;overflow:auto">${folders.map(f=>`<div class="ac-row"><div class="grow">📁 ${_acEsc(f.name)}${f.childCount?' <span class="ac-muted">('+f.childCount+')</span>':''}</div><button class="ac-btn" data-add data-id="${_acEsc(f.id)}" data-name="${_acEsc(f.name)}">Adicionar</button></div>`).join('')||'<div class="ac-muted">Nenhuma pasta na raiz.</div>'}</div></div>`;
  (document.getElementById('acessos-screen')||document.body).appendChild(ov);const close=()=>ov.remove();
  ov.addEventListener('click',e=>{if(e.target===ov)close();});
  ov.querySelector('#x').onclick=close;
  ov.querySelectorAll('button[data-add]').forEach(b=>b.addEventListener('click',async()=>{
    const ordem=(_acDriveMarcas.reduce((mx,m)=>Math.max(mx,m.ordem||0),0))+1;
    const{error}=await sbClient.from('acessos_drive_marcas').insert({nome:b.dataset.name,external_id:b.dataset.id,ordem});
    if(error){adminToast('Erro: '+error.message,false);return;}
    await _acLog('drive.marca.add','marca:'+b.dataset.name,'ok',null);adminToast('Marca adicionada');close();_acRenderDrive();
  }));
}
async function _acDriveDelMarca(id){
  const m=_acDriveMarcas.find(x=>x.id===id);if(!m)return;
  if(!confirm('Remover a marca "'+m.nome+'" do Drive? (não apaga nada no OneDrive)'))return;
  const{error}=await sbClient.from('acessos_drive_marcas').delete().eq('id',id);
  if(error){adminToast('Erro: '+error.message,false);return;}
  if(_acDriveSel===id)_acDriveSel=null;
  await _acLog('drive.marca.del','marca:'+m.nome,'ok',null);adminToast('Marca removida');_acRenderDrive();
}
function _acCopy(text,btn){
  if(!text)return;
  const ok=()=>{if(btn){const o=btn.dataset.lbl||btn.textContent;btn.dataset.lbl=o;btn.textContent='✓ Copiado';btn.disabled=true;setTimeout(()=>{btn.textContent=o;btn.disabled=false;},1400);}else adminToast('Link copiado');};
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(ok).catch(()=>{_acCopyFallback(text);ok();});}
  else{_acCopyFallback(text);ok();}
}
function _acCopyFallback(text){try{const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';(document.getElementById('acessos-screen')||document.body).appendChild(ta);ta.focus();ta.select();document.execCommand('copy');ta.remove();}catch(e){}}
// Auto-correção de APELIDO: quando o e-mail convidado resolve p/ uma conta Microsoft diferente
// (ex.: @outlook → @gmail), o acesso JÁ caiu na conta real. Aqui atualizamos o cadastro do
// colaborador (email_outlook) p/ essa conta real, garantindo que futuros compartilhamentos /
// auditoria / remoção apontem pra conta certa e o problema não se repita.
async function _acFixAliases(mism){
  const out=[];
  for(const m of (mism||[])){
    const inv=String(m.invited||'').toLowerCase(), acct=m.account;
    if(!acct||acct.toLowerCase()===inv){continue;}
    const p=(((_acData||{}).pessoas)||[]).find(x=>x&&String(x.email_outlook||'').toLowerCase()===inv);
    let nome=null;
    if(p){
      try{const{error}=await sbClient.from('acessos_pessoas').update({email_outlook:acct,atualizado_em:new Date().toISOString()}).eq('id',p.id);
        if(!error){p.email_outlook=acct;nome=p.nome;await _acLog('drive.corrigeAlias','colab:'+p.nome,'ok',m.invited+' → '+acct);}
      }catch(e){}
    }
    out.push({invited:m.invited,account:acct,nome});
  }
  return out;
}
async function _acDriveShare(itemId,name){
  let shares=[],folderLink='';try{const r=await _acProxy('microsoft.shares',{itemId});shares=(r&&r.shares)||[];folderLink=(r&&r.link)||'';}catch(e){}
  const ov=document.createElement('div');ov.className='ac-modal-ov open';ov.id='ac-drv-share';
  let _picker;try{_picker=_acColabPicker('ac-drv-cb');}catch(err){console.error('[acessos] picker erro',err);adminToast('ERRO no painel: '+((err&&err.message)||err),false);_picker='<div class="ac-card" style="color:#f87171">Falha ao montar a lista de colaboradores: '+_acEsc((err&&err.message)||String(err))+'</div>';}
  ov.innerHTML=`<div class="ac-modal ac-modal-lg">
    <div class="ac-modal-head"><h3 style="margin:0">Compartilhar — ${_acEsc(name)}</h3><button class="ac-btn ghost" id="ac-drv-x">Fechar</button></div>
    <div class="ac-modal-body">
      ${folderLink?`<div class="ac-linkbar"><div class="grow" style="min-width:0"><div class="ac-kicker" style="display:block;margin:0 0 3px">Link da pasta — envie ao colaborador</div><div class="ac-linkurl">${_acEsc(folderLink)}</div></div><button class="ac-btn primary" id="ac-drv-copy">Copiar link</button></div>`:''}
      ${shares.length?`<div class="ac-kicker" style="display:block;margin:0 0 6px">Quem já tem acesso</div><div style="margin-bottom:16px">${shares.map(s=>`<div class="ac-row"><div class="grow">${_acEsc(s.name||s.email||'—')}${(s.email&&s.name)?' <span class="ac-muted">'+_acEsc(s.email)+'</span>':''} <span class="ac-pill ${s.role==='edição'?'warn':'ok'}">${_acEsc(s.role)}</span></div><button class="ac-btn danger" data-uns data-perm="${_acEsc(s.permId)}">Remover</button></div>`).join('')}</div>`:''}
      <div class="ac-kicker" style="display:block;margin:0 0 6px">Adicionar colaboradores</div>
      ${_picker}
    </div>
    <div class="ac-modal-foot">
      <span class="ac-pick-count">0 selecionados</span>
      <input class="ac-input" id="ac-drv-extra" placeholder="ou e-mail avulso" style="flex:1;min-width:120px">
      <select class="ac-select" id="ac-drv-role" style="width:auto"><option value="leitura">Leitura</option><option value="edição">Edição</option></select>
      <button class="ac-btn primary" id="ac-drv-go">Compartilhar</button>
    </div>
  </div>`;
  (document.getElementById('acessos-screen')||document.body).appendChild(ov);const close=()=>ov.remove();
  ov.addEventListener('click',e=>{if(e.target===ov)close();});
  ov.querySelector('#ac-drv-x').onclick=close;
  {const cb=ov.querySelector('#ac-drv-copy');if(cb)cb.onclick=()=>_acCopy(folderLink,cb);}
  ov.querySelectorAll('button[data-uns]').forEach(b=>b.addEventListener('click',async()=>{
    if(!confirm('Remover este acesso?'))return;
    try{await _acProxy('microsoft.unshare',{itemId,permId:b.dataset.perm});adminToast('Acesso removido');close();_acDriveShare(itemId,name);}catch(e){adminToast('Erro: '+e.message,false);}
  }));
  ov.querySelector('#ac-drv-go').onclick=async()=>{
    const role=ov.querySelector('#ac-drv-role').value;
    const emails=[...ov.querySelectorAll('.ac-drv-cb:checked')].map(c=>c.dataset.email);
    const extra=ov.querySelector('#ac-drv-extra').value.trim();if(extra)emails.push(extra);
    if(!emails.length){adminToast('Selecione ao menos um colaborador ou informe um e-mail',false);return;}
    const btn=ov.querySelector('#ac-drv-go');btn.disabled=true;btn.textContent='Compartilhando…';
    try{await _acProxy('microsoft.addFolder',{itemId,name});}catch(e){}
    let ok=0,mism=[];for(const email of emails){try{const r=await _acProxy('microsoft.share',{itemId,email,role});if(r&&!r.error){ok++;if(r.account&&r.account.toLowerCase()!==email.toLowerCase())mism.push({invited:email,account:r.account});}}catch(e){}}
    await _acLog('drive.share','pasta:'+name,ok===emails.length?'ok':'parcial',ok+'/'+emails.length);
    const fixes=await _acFixAliases(mism);
    if(fixes.length)adminToast('✅ Apelido corrigido: '+fixes.map(f=>(f.nome||f.invited)+' → '+f.account).join(' · ')+' — cadastro atualizado p/ a conta real; acesso garantido');
    else adminToast('Compartilhado com '+ok+'/'+emails.length);
    close();_acDriveShare(itemId,name);
  };
}
async function loadAcessos(){
  const body=document.getElementById('ac-body');
  body.innerHTML='<div class="ac-muted">Carregando…</div>';
  const[og,se,p]=await Promise.all([
    sbClient.from('acessos_organizacoes').select('*').order('ordem').order('nome'),
    sbClient.from('acessos_setores').select('*').order('ordem').order('nome'),
    sbClient.from('acessos_pessoas').select('*').order('nome')
  ]);
  if(p.error){body.innerHTML='<div class="ac-card">Erro: '+_acEsc(p.error.message)+'</div>';return;}
  _acData.organizacoes=og.data||[];
  _acData.setores=se.data||[];
  _acData.pessoas=p.data||[];
  _acRender();
}
function _acRender(){
  document.querySelectorAll('#acessos-screen .ac-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===_acTab));
  if(_acTab==='auditoria')return _acRenderAuditoria();
  if(_acTab==='drive')return _acRenderDrive();
  if(_acTab==='config')return _acRenderConfiguracoes();
  if(_acTab==='onedrive')return _acRenderOneDrive();
  if(_acTab==='icloud')return _acRenderICloud();
  if(_acSel)return _acRenderFicha(_acSel);
  if(_acSelSetor!==null)return _acRenderColaboradores(_acSelSetor);
  if(_acSelOrg!==null)return _acRenderSetores(_acSelOrg);
  return _acRenderOrganizacoes();
}
function _acSetorIco(){return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/></svg>';}
function _acOrgIco(){return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M9 8h.01M9 12h.01M9 16h.01M15 8h.01M15 12h.01M15 16h.01"/></svg>';}
var _acOrgOpen=_acOrgOpen||{};
function _acToggleOrg(key){
  _acOrgOpen[key]=(_acOrgOpen[key]===false);
  const el=document.querySelector('#acessos-screen .ac-org-block[data-org="'+key+'"]');
  if(el)el.classList.toggle('open',_acOrgOpen[key]!==false);
}
function _acRenderOrganizacoes(){
  const body=document.getElementById('ac-body');
  const orgs=(_acData.organizacoes||[]);
  const setorOrg=(p)=>{const st=_acData.setores.find(s=>s.id===p.setor_id);return p.organizacao_id||(st?st.organizacao_id:null)||null;};
  const totalColab=_acData.pessoas.length;
  const totalAtivos=_acData.pessoas.filter(p=>p.status==='ativo').length;
  const bloco=(org)=>{
    const oid=org?org.id:null,key=oid===null?'_none':oid;
    const setores=_acData.setores.filter(s=>oid?s.organizacao_id===oid:!s.organizacao_id);
    const colabsOrg=_acData.pessoas.filter(p=>setorOrg(p)===oid);
    const open=_acOrgOpen[key]!==false;
    // colaboradores sem setor dentro desta org
    const semSetor=colabsOrg.filter(p=>!p.setor_id);
    const stcards=setores.map(s=>{
      const ppl=_acData.pessoas.filter(x=>x.setor_id===s.id);
      const na=ppl.filter(x=>x.status==='ativo').length;
      const avas=ppl.slice(0,5).map(p=>_acAvatar(p,28)).join('');
      const more=ppl.length>5?`<span class="ac-ava-more">+${ppl.length-5}</span>`:'';
      return `<div class="ac-stcard" onclick="_acOpenSetor('${s.id}')">
        <div class="ac-stcard-h"><span class="ac-stcard-name">${_acEsc(s.nome)}</span><span class="ac-stcard-ct">${ppl.length}${(na<ppl.length)?(' · '+na+'✓'):''}</span></div>
        ${ppl.length?`<div class="ac-ava-stack">${avas}${more}</div>`:'<div class="ac-empty" style="padding:8px 0 0">Sem colaboradores</div>'}
      </div>`;
    }).join('');
    const semSetorCard=semSetor.length?`<div class="ac-stcard" onclick="_acOpenSetor(false)" style="border-style:dashed">
        <div class="ac-stcard-h"><span class="ac-stcard-name" style="color:var(--muted)">Sem setor</span><span class="ac-stcard-ct" style="background:rgba(148,163,184,.18);color:#cbd5e1">${semSetor.length}</span></div>
        <div class="ac-ava-stack">${semSetor.slice(0,5).map(p=>_acAvatar(p,28)).join('')}${semSetor.length>5?'<span class="ac-ava-more">+'+(semSetor.length-5)+'</span>':''}</div>
      </div>`:'';
    return `<div class="ac-org-block ${open?'open':''}" data-org="${key}">
      <div class="ac-org-head" onclick="_acToggleOrg('${key}')">
        <div class="ac-org-badge">${_acOrgIco()}</div>
        <div style="min-width:0">
          <div class="ac-org-name">${_acEsc(org?org.nome:'Sem organização')}</div>
          <div class="ac-org-meta">${setores.length} setor(es) · ${colabsOrg.length} pessoa(s) · ${colabsOrg.filter(p=>p.status==='ativo').length} ativo(s)</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;margin-left:auto" onclick="event.stopPropagation()">
          <button class="ac-btn ghost" onclick="_acAddSetor(${oid?"'"+oid+"'":'false'})">+ Setor</button>
          ${org?`<button class="ac-setor-del" style="position:static;opacity:.8" title="Excluir organização" onclick="_acDelOrg('${oid}')">✕</button>`:''}
        </div>
        <svg class="ac-org-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
      </div>
      <div class="ac-org-body">${stcards}${semSetorCard}${(!setores.length&&!semSetor.length)?'<div class="ac-empty">Nenhum setor ainda. Use "+ Setor".</div>':''}</div>
    </div>`;
  };
  let html=orgs.map(bloco).join('');
  const orglessSet=_acData.setores.filter(s=>!s.organizacao_id);
  const orglessCol=_acData.pessoas.filter(p=>setorOrg(p)===null);
  if(orglessSet.length||orglessCol.length) html+=bloco(null);
  body.innerHTML=`
    <div class="ac-hero">
      <div>
        <h2>Colaboradores & Acessos</h2>
        <div class="ac-sub">${totalColab} colaborador(es) · ${totalAtivos} ativo(s) · ${orgs.length} organização(ões)</div>
      </div>
      <div class="ac-hero-actions">
        <button class="ac-btn ghost lg" onclick="_acAddOrg()">+ Nova organização</button>
        <button class="ac-btn primary lg" onclick="_acFormColaborador(null,'')">+ Novo colaborador</button>
      </div>
    </div>
    ${html||'<div class="ac-empty">Nenhuma organização ainda. Crie uma para começar.</div>'}`;
}
function _acRenderConfiguracoes(){
  const body=document.getElementById('ac-body');
  body.innerHTML=`
    <div class="ac-hero">
      <div><h2>Conexões</h2><div class="ac-sub">Estado das integrações que alimentam o módulo. Reconecte se algo aparecer como "não conectado".</div></div>
    </div>
    <div class="ac-conn-grid">
      <div class="ac-conn">
        <div class="ac-conn-top">${_acLogo('zoho')}<span class="ac-conn-name">Zoho Mail</span><span style="margin-left:auto" id="ac-zoho-status" class="ac-muted">verificando…</span></div>
        <div class="ac-conn-desc">Importa colaboradores (nome, e-mail corporativo e foto) da sua organização Zoho, e cria/suspende caixas de e-mail.</div>
        <div class="ac-conn-actions">
          <button class="ac-btn ghost" onclick="_acConectarZoho()">Conectar / reconectar</button>
          <button class="ac-btn" id="ac-zoho-import" style="display:none" onclick="_acImportarZoho()">Importar usuários</button>
        </div>
      </div>
      <div class="ac-conn">
        <div class="ac-conn-top">${_acLogo('ms')}<span class="ac-conn-name">OneDrive</span><span style="margin-left:auto" id="ac-od-status" class="ac-muted">verificando…</span></div>
        <div class="ac-conn-desc">Compartilhamento das pastas que você controla (conta Microsoft pessoal). A gestão de pastas fica na aba Drive.</div>
        <div class="ac-conn-actions">
          <button class="ac-btn ghost" onclick="_acConectarOneDrive()">Conectar / reconectar</button>
          <button class="ac-btn" onclick="_acSetTab('drive')">Ir para o Drive →</button>
        </div>
      </div>
      <div class="ac-conn">
        <div class="ac-conn-top">${_acLogo('apple')}<span class="ac-conn-name">iCloud</span><span style="margin-left:auto" class="ac-pill neutral">manual</span></div>
        <div class="ac-conn-desc">Sem API — cadastre as pastas e os acessos; você compartilha na Apple e marca "feito".</div>
        <div class="ac-conn-actions">
          <button class="ac-btn ghost" onclick="_acOpenICloud()">Gerenciar pastas</button>
        </div>
      </div>
    </div>`;
  _acZohoStatus();
  _acODStatus();
}
function _acOpenOrg(orgId){_acSelOrg=orgId;_acSelSetor=null;_acSel=null;_acRender();}
async function _acAddOrg(){
  const nome=prompt('Nome da nova organização:');if(!nome||!nome.trim())return;
  const ordem=((_acData.organizacoes||[]).reduce((mx,o)=>Math.max(mx,o.ordem||0),0))+1;
  const{error}=await sbClient.from('acessos_organizacoes').insert({nome:nome.trim(),ordem});
  if(error){adminToast('Erro: '+error.message,false);return;}
  await _acLog('org.criar','org:'+nome.trim(),'ok',null);adminToast('Organização criada');await loadAcessos();
}
async function _acDelOrg(id){
  const o=(_acData.organizacoes||[]).find(x=>x.id===id);if(!o)return;
  const ns=_acData.setores.filter(s=>s.organizacao_id===id).length;
  if(!confirm(`Excluir a organização "${o.nome}"?`+(ns?` Os ${ns} setor(es) ficarão sem organização.`:'')))return;
  const{error}=await sbClient.from('acessos_organizacoes').delete().eq('id',id);
  if(error){adminToast('Erro: '+error.message,false);return;}
  await _acLog('org.excluir','org:'+o.nome,'ok',null);adminToast('Organização excluída');await loadAcessos();
}
function _acRenderSetores(orgId){
  const body=document.getElementById('ac-body');
  const org=orgId?(_acData.organizacoes||[]).find(o=>o.id===orgId):null;
  const setores=_acData.setores.filter(s=>orgId?s.organizacao_id===orgId:!s.organizacao_id);
  const cards=setores.map((s,i)=>{
    const n=_acData.pessoas.filter(x=>x.setor_id===s.id).length;
    const na=_acData.pessoas.filter(x=>x.setor_id===s.id&&x.status==='ativo').length;
    return `<div class="ac-setor-card" style="animation-delay:${i*40}ms" onclick="_acOpenSetor('${s.id}')">
      <button class="ac-setor-del" title="Excluir setor" onclick="event.stopPropagation();_acDelSetor('${s.id}')">✕</button>
      <div class="ac-setor-ico">${_acSetorIco()}</div>
      <div class="ac-setor-nome">${_acEsc(s.nome)}</div>
      <div class="ac-setor-sub">${n} colaborador(es)</div>
      <span class="ac-count">● ${na} ativo(s)</span>
    </div>`;
  }).join('');
  body.innerHTML=`
    <div class="ac-section-h">
      <button class="ac-btn ghost" onclick="_acVoltarSel('org')">← Organizações</button>
      <h3 style="margin-left:6px">${_acEsc(org?org.nome:'Sem organização')}</h3>
      <button class="ac-btn" style="margin-left:auto" onclick="_acAddSetor(${orgId?"'"+orgId+"'":'false'})">+ Novo setor</button>
    </div>
    <div class="ac-setores-grid">${cards||'<div class="ac-muted">Nenhum setor aqui ainda.</div>'}</div>`;
}
async function _acAddSetor(orgId){
  const nome=prompt('Nome do novo setor:');if(!nome||!nome.trim())return;
  const ordem=(_acData.setores.reduce((mx,s)=>Math.max(mx,s.ordem||0),0))+1;
  const{error}=await sbClient.from('acessos_setores').insert({nome:nome.trim(),ordem,organizacao_id:orgId||null});
  if(error){adminToast('Erro: '+error.message,false);return;}
  await _acLog('setor.criar','setor:'+nome.trim(),'ok',null);adminToast('Setor criado');await loadAcessos();
}
async function _acDelSetor(id){
  const s=_acData.setores.find(x=>x.id===id);if(!s)return;
  const n=_acData.pessoas.filter(x=>x.setor_id===id).length;
  if(!confirm(`Excluir o setor "${s.nome}"?`+(n?` Os ${n} colaborador(es) ficarão sem setor.`:'')))return;
  const{error}=await sbClient.from('acessos_setores').delete().eq('id',id);
  if(error){adminToast('Erro: '+error.message,false);return;}
  await _acLog('setor.excluir','setor:'+s.nome,'ok',null);
  adminToast('Setor excluído');await loadAcessos();
}
function _acOpenSetor(setorId){_acSelSetor=setorId;_acSel=null;_acRender();}
async function _acRenderColaboradores(setorId){
  const body=document.getElementById('ac-body');
  const setor=setorId?_acData.setores.find(s=>s.id===setorId):null;
  const lista=_acData.pessoas.filter(x=>setorId?x.setor_id===setorId:!x.setor_id);
  const rows=lista.map(c=>`
    <div class="ac-row ac-person">
      ${_acAvatar(c,46)}
      <div class="grow">
        <div class="ac-person-name">${_acEsc(c.nome)} ${c.status==='desligado'?'<span class="ac-pill neutral">desligado</span>':'<span class="ac-pill ok">ativo</span>'}</div>
        ${c.cargo?`<div class="ac-kicker">${_acEsc(c.cargo)}</div>`:''}
        ${c.email_corporativo?`<div class="ac-person-email">${_acEsc(c.email_corporativo)}</div>`:''}
      </div>
      <button class="ac-btn ghost" onclick="_acOpenPessoa('${c.id}')">Abrir ficha →</button>
    </div>`).join('');
  body.innerHTML=`
    <div class="ac-section-h">
      <button class="ac-btn ghost" onclick="_acVoltarSel('setor')">← Setores</button>
      <h3 style="margin-left:6px">${_acEsc(setor?setor.nome:'Sem setor')}</h3>
      <button class="ac-btn" style="margin-left:auto" onclick="_acFormColaborador(null,'${setorId||''}')">+ Novo colaborador</button>
    </div>
    ${rows||'<div class="ac-muted">Nenhum colaborador neste setor.</div>'}`;
}
function _acOpenPessoa(id){_acSel=id;_acTab='org';_acRender();}
function _acFormSetorOpts(orgId,sel){
  const list=(_acData.setores||[]).filter(s=>orgId?s.organizacao_id===orgId:!s.organizacao_id);
  return ['<option value="">— Sem setor —</option>'].concat(list.map(s=>`<option value="${s.id}" ${s.id===sel?'selected':''}>${_acEsc(s.nome)}</option>`)).join('');
}
function _acFormColaborador(id,setorIdPre){
  const c=id?_acData.pessoas.find(x=>x.id===id):{nome:'',cargo:'',organizacao_id:null,setor_id:(setorIdPre||null),email_corporativo:'',email_outlook:'',conta_apple:'',numero_corporativo:'',numero_pessoal:'',data_inicio_contrato:''};
  if(!c)return;
  const setorRow=(_acData.setores||[]).find(s=>s.id===c.setor_id);
  const curOrg=c.organizacao_id||(setorRow&&setorRow.organizacao_id)||'';
  const orgOpts=['<option value="">— Sem organização —</option>'].concat((_acData.organizacoes||[]).map(o=>`<option value="${o.id}" ${o.id===curOrg?'selected':''}>${_acEsc(o.nome)}</option>`)).join('');
  document.getElementById('ac-body').innerHTML=`
    <div class="ac-card" style="max-width:700px">
      <h3 style="margin-top:0">${id?'Editar colaborador':'Novo colaborador'}</h3>
      <div class="ac-grid2">
        <label style="grid-column:1/-1">Nome completo<input class="ac-input" id="acc-nome" value="${_acEsc(c.nome||'')}"></label>
        <label>Cargo<input class="ac-input" id="acc-cargo" value="${_acEsc(c.cargo||'')}"></label>
        <label>Organização<select class="ac-select" id="acc-org" onchange="document.getElementById('acc-setor').innerHTML=_acFormSetorOpts(this.value,null)">${orgOpts}</select></label>
        <label>Setor<select class="ac-select" id="acc-setor">${_acFormSetorOpts(curOrg,c.setor_id)}</select></label>
        <label>${_acLogo('zoho')}E-mail corporativo (Zoho)<input class="ac-input" id="acc-email" value="${_acEsc(c.email_corporativo||'')}"></label>
        <label>${_acLogo('ms')}E-mail Outlook (OneDrive)<input class="ac-input" id="acc-outlook" value="${_acEsc(c.email_outlook||'')}"></label>
        <label>${_acLogo('apple')}Conta Apple (iCloud / MacBook)<input class="ac-input" id="acc-apple" value="${_acEsc(c.conta_apple||'')}"></label>
        <label>Celular corporativo<input class="ac-input" id="acc-ncorp" value="${_acEsc(c.numero_corporativo||'')}"></label>
        <label>Celular pessoal<input class="ac-input" id="acc-npess" value="${_acEsc(c.numero_pessoal||'')}"></label>
        <label>Início de contrato<input class="ac-input" id="acc-inicio" type="date" value="${_acEsc(c.data_inicio_contrato||'')}"></label>
      </div>
      <div style="margin-top:14px;display:flex;gap:8px">
        <button class="ac-btn" onclick="_acSaveColaborador(${id?"'"+id+"'":'null'})">Salvar</button>
        <button class="ac-btn ghost" onclick="${id?"_acOpenPessoa('"+id+"')":"_acRender()"}">Cancelar</button>
      </div>
    </div>`;
}
async function _acSaveColaborador(id){
  const rec={
    nome:document.getElementById('acc-nome').value.trim(),
    cargo:document.getElementById('acc-cargo').value.trim()||null,
    setor_id:document.getElementById('acc-setor').value||null,
    organizacao_id:document.getElementById('acc-org').value||null,
    email_corporativo:document.getElementById('acc-email').value.trim()||null,
    email_outlook:document.getElementById('acc-outlook').value.trim()||null,
    conta_apple:document.getElementById('acc-apple').value.trim()||null,
    numero_corporativo:document.getElementById('acc-ncorp').value.trim()||null,
    numero_pessoal:document.getElementById('acc-npess').value.trim()||null,
    data_inicio_contrato:document.getElementById('acc-inicio').value||null,
    atualizado_em:new Date().toISOString()
  };
  if(!rec.nome){adminToast('Nome é obrigatório',false);return;}
  const isEdit=!!id;
  let err;
  if(id){({error:err}=await sbClient.from('acessos_pessoas').update(rec).eq('id',id));}
  else{const r=await sbClient.from('acessos_pessoas').insert(rec).select('id').single();err=r.error;id=r.data?.id;}
  if(err){adminToast('Erro: '+err.message,false);return;}
  await _acLog(isEdit?'colaborador.editar':'colaborador.criar','colab:'+rec.nome,'ok',null);
  adminToast('Colaborador salvo');
  await loadAcessos();_acOpenPessoa(id);
  // Onboarding (opção B): colaborador NOVO → abre o provisionamento de acessos na sequência
  if(!isEdit)setTimeout(()=>_acProvisionar(id),250);
}
function _acRenderFicha(id){
  const c=_acData.pessoas.find(x=>x.id===id);
  if(!c){_acSel=null;return _acRender();}
  const setor=c.setor_id?(_acData.setores.find(s=>s.id===c.setor_id)||{}).nome:null;
  const _orgId=c.organizacao_id||(c.setor_id?(_acData.setores.find(s=>s.id===c.setor_id)||{}).organizacao_id:null);
  const orgNome=_orgId?(_acData.organizacoes.find(o=>o.id===_orgId)||{}).nome:null;
  const dt=v=>v?_acEsc(new Date(v+'T00:00:00').toLocaleDateString('pt-BR')):'—';
  const statusPill=c.status==='desligado'?'<span class="ac-pill neutral">desligado</span>':'<span class="ac-pill ok">ativo</span>';
  const fld=(label,val)=>`<div class="ac-field"><span class="ac-field-l">${label}</span><span class="ac-field-v ${(val&&val!=='—')?'':'empty'}">${val||'—'}</span></div>`;
  const acct=(logo,label,val)=>`<div class="ac-field"><span class="ac-field-l">${logo}${label}</span><span class="ac-field-v ${val?'':'empty'}">${val?_acEsc(val):'<span class="ac-pill neutral" style="font-size:9px">não configurado</span>'}</span></div>`;
  const subParts=[c.cargo?_acEsc(c.cargo):'',orgNome?_acEsc(orgNome):'',setor?_acEsc(setor):'Sem setor'].filter(Boolean);
  document.getElementById('ac-body').innerHTML=`
    <button class="ac-btn ghost" onclick="_acVoltarSel('pessoa')">← Voltar</button>
    <div class="ac-card" style="margin-top:12px;padding:20px 22px">
      <div class="ac-ficha-hero">
        ${_acAvatar(c,72)}
        <div class="ac-ficha-id">
          <div class="ac-ficha-name">${_acEsc(c.nome)} ${statusPill}</div>
          <div class="ac-ficha-sub">${subParts.map((p,i)=>(i?'<span class="dot">•</span>':'')+'<span>'+p+'</span>').join('')}</div>
        </div>
      </div>
      <div class="ac-ficha-actions">
        <button class="ac-btn ghost" onclick="_acFormColaborador('${c.id}')">Editar</button>
        ${c.status==='ativo'?`<button class="ac-btn primary" onclick="_acProvisionar('${c.id}')">Provisionar acessos</button>`:''}
        ${c.status==='ativo'?`<button class="ac-btn danger" onclick="_acDesligar('${c.id}')">Desligar</button>`:`<button class="ac-btn" onclick="_acReativar('${c.id}')">Reativar</button>`}
        <button class="ac-btn ghost" onclick="document.getElementById('ac-av-file').click()">Trocar foto</button>
        <input id="ac-av-file" type="file" accept="image/*" style="display:none" onchange="_acUploadAvatar('${c.id}',this.files[0])">
        ${estado.role==='admin'?`<button class="ac-btn danger" onclick="_acExcluirColaborador('${c.id}')">Excluir</button>`:''}
      </div>
      <div class="ac-fgrid">
        <div class="ac-fblock">
          <div class="ac-fblock-h">Contas & Acessos</div>
          ${acct(_acLogo('zoho'),'Corporativo',c.email_corporativo)}
          ${acct(_acLogo('ms'),'Outlook',c.email_outlook)}
          ${acct(_acLogo('apple'),'Apple',c.conta_apple)}
        </div>
        <div class="ac-fblock">
          <div class="ac-fblock-h">Contato</div>
          ${fld('Celular corporativo',c.numero_corporativo?_acEsc(c.numero_corporativo):'—')}
          ${fld('Celular pessoal',c.numero_pessoal?_acEsc(c.numero_pessoal):'—')}
        </div>
        <div class="ac-fblock">
          <div class="ac-fblock-h">Contrato</div>
          ${fld('Início',dt(c.data_inicio_contrato))}
          ${c.status==='desligado'?fld('Fim',dt(c.data_fim_contrato)):''}
          ${c.status==='desligado'?fld('Motivo da saída',c.motivo_saida?_acEsc(c.motivo_saida):'—'):''}
        </div>
      </div>
    </div>
    <div id="ac-disp-wrap"></div>
    <div id="ac-vei-wrap"></div>
    <div id="ac-termos-wrap"></div>`;
  if(window._acRenderDispositivos)_acRenderDispositivos(id);
  if(window._acRenderVeiculos)_acRenderVeiculos(id);
  if(window._acRenderTermos)_acRenderTermos(id);
}
function _acDesligar(id){
  const c=_acData.pessoas.find(x=>x.id===id);if(!c)return;
  const hoje=hojeLocal(); // BRT: às 22h o default vinha com a data de amanhã
  const ov=document.createElement('div');ov.className='ac-modal-ov open';ov.id='ac-dlg-ov';
  ov.innerHTML=`<div class="ac-modal">
    <h3 style="margin-top:0">Desligar ${_acEsc(c.nome)}</h3>
    <label style="display:block">Motivo do desligamento
      <textarea class="ac-textarea" id="ac-dlg-motivo" style="min-height:80px"></textarea></label>
    <label style="display:block;margin-top:10px">Data de fim de contrato
      <input class="ac-input" type="date" id="ac-dlg-data" value="${hoje}"></label>
    <div class="ac-kicker" style="margin:14px 0 6px;display:block">Revogar acessos</div>
    <label style="display:flex;align-items:center;gap:8px;margin-top:6px"><input type="checkbox" id="ac-dlg-equip" checked> Marcar equipamentos em uso para devolução</label>
    <label style="display:flex;align-items:center;gap:8px;margin-top:6px"><input type="checkbox" id="ac-dlg-od" ${c.email_outlook?'checked':'disabled'}> Remover dos compartilhamentos do OneDrive${c.email_outlook?'':' <span class="ac-muted">(sem e-mail Outlook)</span>'}</label>
    <label style="display:flex;align-items:center;gap:8px;margin-top:6px"><input type="checkbox" id="ac-dlg-zoho" ${c.email_corporativo?'checked':'disabled'}> Suspender caixa de e-mail Zoho${c.email_corporativo?'':' <span class="ac-muted">(sem e-mail corporativo)</span>'}</label>
    <div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end">
      <button class="ac-btn ghost" id="ac-dlg-cancel">Cancelar</button>
      <button class="ac-btn danger" id="ac-dlg-ok">Confirmar desligamento</button>
    </div>
  </div>`;
  (document.getElementById('acessos-screen')||document.body).appendChild(ov);
  const close=()=>ov.remove();
  ov.addEventListener('click',e=>{if(e.target===ov)close();});
  ov.querySelector('#ac-dlg-cancel').onclick=close;
  ov.querySelector('#ac-dlg-ok').onclick=async()=>{
    const motivo=ov.querySelector('#ac-dlg-motivo').value.trim();
    const data=ov.querySelector('#ac-dlg-data').value||null;
    if(!motivo){adminToast('Informe o motivo',false);return;}
    const doEquip=ov.querySelector('#ac-dlg-equip').checked;
    const doOd=ov.querySelector('#ac-dlg-od').checked&&!!c.email_outlook;
    const doZoho=ov.querySelector('#ac-dlg-zoho').checked&&!!c.email_corporativo;
    const okBtn=ov.querySelector('#ac-dlg-ok');okBtn.disabled=true;okBtn.textContent='Processando…';
    const{error}=await sbClient.from('acessos_pessoas').update({status:'desligado',motivo_saida:motivo,data_fim_contrato:data,atualizado_em:new Date().toISOString()}).eq('id',id);
    if(error){adminToast('Erro: '+error.message,false);okBtn.disabled=false;okBtn.textContent='Confirmar desligamento';return;}
    let resumo='Desligado';
    if(doEquip){
      const{error:e2}=await sbClient.from('acessos_dispositivos').update({status:'a_devolver',atualizado_em:new Date().toISOString()}).eq('pessoa_id',id).eq('status','em_uso');
      resumo+=e2?' · equip. falhou':' · equipamentos → devolução';
    }
    if(doOd){
      try{const r=await _acProxy('microsoft.revokeForEmail',{email:c.email_outlook});resumo+=' · OneDrive: '+(r&&r.removed||0)+' removido(s)';}
      catch(e){resumo+=' · OneDrive falhou';}
    }
    if(doZoho){
      try{const r=await _acProxy('zoho.suspend',{email:c.email_corporativo});resumo+=(r&&r.ok)?' · Zoho suspenso':(' · Zoho falhou'+(r&&r.error?' ('+r.error+')':''));}
      catch(e){resumo+=' · Zoho falhou';}
    }
    let iclNomes=[];
    // O filtro de arquivado_em é feito aqui no JS (e não na query) de propósito:
    // filtrar campo de tabela ligada no PostgREST muda o jeito que a junção
    // funciona e poderia sumir com VÍNCULO, não só com pasta arquivada. Aqui a
    // consulta continua trazendo o que sempre trouxe; só a pasta arquivada é
    // pulada na hora de montar o aviso.
    try{const{data:vs}=await sbClient.from('acessos_vinculos').select('acessos_recursos(nome,tipo,arquivado_em)').eq('pessoa_id',id);(vs||[]).forEach(v=>{const r=v.acessos_recursos;if(r&&r.tipo==='icloud'&&!r.arquivado_em)iclNomes.push(r.nome);});}catch(e){}
    await _acLog('colaborador.desligar','colab:'+c.nome,'ok',data||null);
    close();adminToast(resumo);
    if(iclNomes.length){setTimeout(()=>adminToast('iCloud (manual): remova de '+iclNomes.join(', '),false),1300);}
    await loadAcessos();_acOpenPessoa(id);
  };
}
async function _acReativar(id){
  const c=_acData.pessoas.find(x=>x.id===id);if(!c)return;
  if(!confirm(`Reativar "${c.nome}"?`+(c.email_corporativo?' (reativa também a caixa Zoho)':'')))return;
  const{error}=await sbClient.from('acessos_pessoas').update({status:'ativo',motivo_saida:null,data_fim_contrato:null,atualizado_em:new Date().toISOString()}).eq('id',id);
  if(error){adminToast('Erro: '+error.message,false);return;}
  let extra='';
  if(c.email_corporativo){try{const r=await _acProxy('zoho.reactivate',{email:c.email_corporativo});if(r&&r.ok)extra=' · Zoho reativado';}catch(e){}}
  await _acLog('colaborador.reativar','colab:'+c.nome,'ok',null);
  adminToast('Colaborador reativado'+extra);await loadAcessos();_acOpenPessoa(id);
}
async function _acProvisionar(id){
  const c=_acData.pessoas.find(x=>x.id===id);if(!c)return;
  const firstName=(c.nome||'').trim().split(/\s+/)[0]||'';
  const _toks=(c.nome||'').trim().split(/\s+/);
  const lastName=_toks.length>1?_toks.slice(1).join(' '):'';
  const _slug=(c.nome||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim().split(/\s+/).filter(Boolean);
  const emailSugg=_slug.length?_slug[0]+(_slug.length>1?'.'+_slug[_slug.length-1]:'')+'@rbvcompany.com':'';
  const hasZoho=!!c.email_corporativo;
  // carrega recursos geridos
  let odFolders=[];try{const r=await _acProxy('microsoft.folders');odFolders=(r&&r.folders)||[];}catch(e){}
  // Só pasta ativa pode ser concedida a alguém: não faz sentido oferecer pasta
  // arquivada no provisionamento de um colaborador novo.
  let icFolders=[];try{const{data}=await sbClient.from('acessos_recursos').select('id,nome').eq('tipo','icloud').is('arquivado_em',null).order('nome');icFolders=data||[];}catch(e){}
  const ov=document.createElement('div');ov.className='ac-modal-ov open';ov.id='ac-prov-ov';
  ov.innerHTML=`<div class="ac-modal" style="max-width:560px">
    <h3 style="margin-top:0">Provisionar acessos — ${_acEsc(c.nome)}</h3>
    <p class="ac-muted" style="margin:.2em 0 1em">Conceda os acessos de entrada deste colaborador. Cada bloco é opcional.</p>

    <div class="ac-kicker" style="display:block;margin-bottom:6px">${_acLogo('zoho')}Caixa de e-mail Zoho</div>
    ${hasZoho
      ? `<div class="ac-muted" style="margin-bottom:14px">Já possui: <b>${_acEsc(c.email_corporativo)}</b></div>`
      : `<label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="ac-prov-zoho-on"> Criar caixa de e-mail</label>
         <div id="ac-prov-zoho-fields" style="display:none;grid-template-columns:1fr;gap:8px;margin:8px 0 14px">
           <label>E-mail<input class="ac-input" id="ac-prov-zoho-email" value="${_acEsc(emailSugg)}"></label>
           <label>Senha inicial<input class="ac-input" type="text" id="ac-prov-zoho-pass" placeholder="senha temporária"></label>
         </div>`}

    <div class="ac-kicker" style="display:block;margin:6px 0">${_acLogo('ms')}Pastas do OneDrive</div>
    ${c.email_outlook
      ? (odFolders.length
          ? odFolders.map(f=>`<label style="display:flex;align-items:center;gap:8px;margin-top:4px"><input type="checkbox" class="ac-prov-od" data-extid="${_acEsc(f.external_id||'')}" data-nome="${_acEsc(f.nome||'')}"> ${_acEsc(f.nome||'(sem nome)')}<select class="ac-select ac-prov-od-role" style="width:auto;margin-left:auto"><option value="leitura">Leitura</option><option value="edição">Edição</option></select></label>`).join('')
          : '<div class="ac-muted">Nenhuma pasta sob controle.</div>')
      : '<div class="ac-pill bad" style="display:inline-block">Sem e-mail Outlook — preencha na ficha para compartilhar.</div>'}

    <div class="ac-kicker" style="display:block;margin:14px 0 6px">${_acLogo('apple')}Acessos iCloud <span class="ac-muted">(registro manual)</span></div>
    ${c.conta_apple
      ? (icFolders.length
          ? icFolders.map(f=>`<label style="display:flex;align-items:center;gap:8px;margin-top:4px"><input type="checkbox" class="ac-prov-ic" data-id="${_acEsc(f.id)}" data-nome="${_acEsc(f.nome||'')}"> ${_acEsc(f.nome||'(sem nome)')}<select class="ac-select ac-prov-ic-role" style="width:auto;margin-left:auto"><option value="leitura">Leitura</option><option value="edicao">Edição</option></select></label>`).join('')
          : '<div class="ac-muted">Nenhuma pasta iCloud cadastrada.</div>')
      : '<div class="ac-pill bad" style="display:inline-block">Sem conta Apple — preencha na ficha.</div>'}

    <div style="margin-top:18px;display:flex;gap:8px;justify-content:flex-end">
      <button class="ac-btn ghost" id="ac-prov-cancel">Cancelar</button>
      <button class="ac-btn" id="ac-prov-ok">Provisionar</button>
    </div>
  </div>`;
  (document.getElementById('acessos-screen')||document.body).appendChild(ov);
  const close=()=>ov.remove();
  ov.addEventListener('click',e=>{if(e.target===ov)close();});
  ov.querySelector('#ac-prov-cancel').onclick=close;
  const zohoChk=ov.querySelector('#ac-prov-zoho-on');
  if(zohoChk)zohoChk.addEventListener('change',()=>{const f=ov.querySelector('#ac-prov-zoho-fields');if(f)f.style.display=zohoChk.checked?'grid':'none';});
  ov.querySelector('#ac-prov-ok').onclick=async()=>{
    const zohoOn=!hasZoho&&zohoChk&&zohoChk.checked;
    const odBoxes=[...ov.querySelectorAll('.ac-prov-od:checked')];
    const icBoxes=[...ov.querySelectorAll('.ac-prov-ic:checked')];
    if(!zohoOn&&!odBoxes.length&&!icBoxes.length){adminToast('Selecione ao menos um acesso',false);return;}
    const okBtn=ov.querySelector('#ac-prov-ok');okBtn.disabled=true;okBtn.textContent='Provisionando…';
    const resumo=[];
    if(zohoOn){
      const email=(ov.querySelector('#ac-prov-zoho-email').value||'').trim();
      const password=ov.querySelector('#ac-prov-zoho-pass').value||'';
      if(!email||!password){adminToast('Preencha e-mail e senha da caixa Zoho',false);okBtn.disabled=false;okBtn.textContent='Provisionar';return;}
      try{
        const r=await _acProxy('zoho.create',{email,password,firstName,lastName});
        if(r&&r.ok){
          await sbClient.from('acessos_pessoas').update({email_corporativo:email,zoho_account_id:r.accountId||null,atualizado_em:new Date().toISOString()}).eq('id',id);
          await _acLog('colaborador.provisionar.zoho','colab:'+c.nome,'ok',email);
          resumo.push('Zoho criado: '+email);
        }else{resumo.push('Zoho falhou'+(r&&(r.detalhe||r.error)?' ('+(r.detalhe||r.error)+')':''));}
      }catch(e){
        if(e.message==='acao_desconhecida'){resumo.push('Zoho: proxy v8 ainda não publicado — caixa NÃO criada');}
        else{resumo.push('Zoho falhou ('+e.message+')');}
      }
    }
    let odOk=0;
    for(const b of odBoxes){
      const itemId=b.dataset.extid;const rs=b.parentElement.querySelector('.ac-prov-od-role');const role=rs?rs.value:'leitura';
      if(!itemId)continue;
      try{const r=await _acProxy('microsoft.share',{itemId,email:c.email_outlook,role});if(r&&!r.error)odOk++;}catch(e){}
    }
    if(odBoxes.length){resumo.push('OneDrive: '+odOk+'/'+odBoxes.length+' pasta(s)');await _acLog('colaborador.provisionar.onedrive','colab:'+c.nome,odOk===odBoxes.length?'ok':'parcial',odOk+'/'+odBoxes.length);}
    let icOk=0;const icNomes=[];
    for(const b of icBoxes){
      const recurso_id=b.dataset.id;const rs=b.parentElement.querySelector('.ac-prov-ic-role');const papel=rs?rs.value:'leitura';
      if(!recurso_id)continue;
      try{const{error}=await sbClient.from('acessos_vinculos').insert({recurso_id,pessoa_id:id,papel,estado:'pendente'});if(!error){icOk++;icNomes.push(b.dataset.nome||'');}}catch(e){}
    }
    if(icBoxes.length){resumo.push('iCloud: '+icOk+' acesso(s) registrado(s)');await _acLog('colaborador.provisionar.icloud','colab:'+c.nome,'ok',String(icOk));}
    close();
    adminToast('Provisionado — '+resumo.join(' · '));
    if(icNomes.filter(Boolean).length){setTimeout(()=>adminToast('iCloud (manual): compartilhe na Apple → '+icNomes.filter(Boolean).join(', '),false),1300);}
    await loadAcessos();_acOpenPessoa(id);
  };
}
async function _acUploadAvatar(pessoaId,file){
  if(!file)return;
  if(!file.type||!file.type.startsWith('image/')){adminToast('Envie uma imagem',false);return;}
  const ext=file.type.includes('png')?'png':file.type.includes('webp')?'webp':'jpg';
  const path=pessoaId+'.'+ext;
  const{error}=await sbClient.storage.from('acessos-avatars').upload(path,file,{upsert:true,contentType:file.type});
  if(error){adminToast('Erro: '+error.message,false);return;}
  const url=SUPABASE_URL+'/storage/v1/object/public/acessos-avatars/'+path+'?v='+Date.now();
  const{error:e2}=await sbClient.from('acessos_pessoas').update({avatar_url:url,atualizado_em:new Date().toISOString()}).eq('id',pessoaId);
  if(e2){adminToast('Erro: '+e2.message,false);return;}
  await _acLog('colaborador.avatar','colab:'+pessoaId,'ok',null);
  adminToast('Foto atualizada');await loadAcessos();_acOpenPessoa(pessoaId);
}
async function _acExcluirColaborador(id){
  if(estado.role!=='admin'){adminToast('Só admin pode excluir',false);return;}
  const c=_acData.pessoas.find(x=>x.id===id);if(!c)return;
  if(!confirm('Excluir DEFINITIVAMENTE "'+c.nome+'"?\nRemove a pessoa e TODOS os dispositivos, veículos e termos dela. Sem volta.'))return;
  try{await sbClient.storage.from('acessos-avatars').remove([id+'.png',id+'.jpg',id+'.webp']);}catch(e){}
  const{error}=await sbClient.from('acessos_pessoas').delete().eq('id',id);
  if(error){adminToast('Erro: '+error.message,false);return;}
  await _acLog('colaborador.excluir','colab:'+c.nome,'ok',null);
  adminToast('Colaborador excluído');_acSel=null;await loadAcessos();
}
const AC_DST=[['em_uso','Em uso','ok'],['a_devolver','A devolver','warn'],['devolvido','Devolvido',''],['perdido','Perdido','bad']];
function _acDstMeta(s){return AC_DST.find(x=>x[0]===s)||[s,s,''];}
const AC_DEV_TIPOS=[['celular','Celular'],['smartphone','Smartphone'],['notebook','Notebook'],['macbook','MacBook'],['desktop','Desktop'],['monitor','Monitor'],['tablet','Tablet'],['numero','Número/Linha'],['chip','Chip/eSIM'],['acessorio','Acessório'],['outro','Outro']];
const AC_VEI_TIPOS=[['carro','Carro'],['moto','Moto'],['caminhonete','Caminhonete'],['outro','Outro']];
const AC_COMB=['Gasolina','Etanol','Flex','Diesel','Elétrico','Híbrido','GNV'];
const AC_FIELDDEFS={celular:[['modelo','Modelo'],['imei','IMEI'],['cor','Cor']],smartphone:[['modelo','Modelo'],['imei','IMEI'],['cor','Cor']],notebook:[['modelo','Modelo'],['serial','Nº de série'],['so','Sistema']],macbook:[['modelo','Modelo'],['serial','Nº de série']],desktop:[['modelo','Modelo'],['serial','Nº de série']],monitor:[['modelo','Modelo'],['serial','Nº de série'],['polegadas','Polegadas']],tablet:[['modelo','Modelo'],['serial','Nº de série'],['imei','IMEI']],numero:[['numero','Número'],['operadora','Operadora'],['plano','Plano']],chip:[['numero','Número'],['operadora','Operadora'],['iccid','ICCID']],acessorio:[['modelo','Modelo']],carro:[['modelo','Modelo'],['ano','Ano'],['placa','Placa'],['combustivel','Combustível'],['renavam','RENAVAM'],['cor','Cor']],moto:[['modelo','Modelo'],['ano','Ano'],['placa','Placa'],['combustivel','Combustível']],caminhonete:[['modelo','Modelo'],['ano','Ano'],['placa','Placa'],['combustivel','Combustível'],['renavam','RENAVAM']],outro:[]};
function _acFieldsFor(t){return AC_FIELDDEFS[t]||[];}
function _acTiposFor(categoria){return categoria==='veiculo'?AC_VEI_TIPOS:AC_DEV_TIPOS;}
function _acItemTipoLabel(t){const a=AC_DEV_TIPOS.concat(AC_VEI_TIPOS).find(x=>x[0]===t);return a?a[1]:t;}
function _acWrapId(categoria){return categoria==='veiculo'?'ac-vei-wrap':'ac-disp-wrap';}
function _acCatTitulo(categoria){return categoria==='veiculo'?'Veículos':'Dispositivos';}
async function _acRenderItens(pessoaId,categoria){
  const wrap=document.getElementById(_acWrapId(categoria));if(!wrap)return;
  const{data,error}=await sbClient.from('acessos_dispositivos').select('*').eq('pessoa_id',pessoaId).eq('categoria',categoria).order('atualizado_em',{ascending:false});
  if(error){wrap.innerHTML='<div class="ac-card">Erro: '+_acEsc(error.message)+'</div>';return;}
  const list=(data||[]).map(d=>{
    const m=_acDstMeta(d.status);
    const det=(d.detalhes&&typeof d.detalhes==='object')?d.detalhes:{};
    const chips=_acFieldsFor(d.tipo).filter(f=>det[f[0]]).map(f=>`<span class="ac-chip">${_acEsc(f[1])}: ${_acEsc(det[f[0]])}</span>`).join('');
    return `<div class="ac-row">
      <div class="grow">
        <div><strong>${_acEsc(_acItemTipoLabel(d.tipo))}</strong> — ${_acEsc(d.descricao)} <span class="ac-pill ${m[2]}">${_acEsc(m[1])}</span></div>
        <div style="margin-top:4px">${chips||'<span class="ac-muted">sem detalhes</span>'}</div>
        ${d.observacao?'<div class="ac-muted" style="margin-top:3px">'+_acEsc(d.observacao)+'</div>':''}
      </div>
      <select class="ac-select" style="width:auto" onchange="_acSetItemStatus('${d.id}','${pessoaId}','${categoria}',this.value)">
        ${AC_DST.map(s=>`<option value="${s[0]}" ${s[0]===d.status?'selected':''}>${s[1]}</option>`).join('')}
      </select>
      <button class="ac-btn ghost" onclick="_acFormItem('${pessoaId}','${categoria}','${d.id}')">Editar</button>
      <button class="ac-btn danger" onclick="_acDelItem('${d.id}','${pessoaId}','${categoria}')">Excluir</button>
    </div>`;}).join('');
  wrap.innerHTML=`<div class="ac-card">
    <div class="ac-section-h"><h3>${_acCatTitulo(categoria)}</h3>
      <button class="ac-btn" style="margin-left:auto" onclick="_acFormItem('${pessoaId}','${categoria}')">+ Adicionar</button></div>
    ${list||'<div class="ac-muted">Nenhum item.</div>'}
  </div>`;
}
function _acRenderVeiculos(pessoaId){return _acRenderItens(pessoaId,'veiculo');}
function _acRenderDispositivos(pessoaId){return _acRenderItens(pessoaId,'dispositivo');}
async function _acFormItem(pessoaId,categoria,id){
  let d={tipo:(categoria==='veiculo'?'carro':'celular'),descricao:'',desde:'',observacao:'',detalhes:{}};
  if(id){const{data}=await sbClient.from('acessos_dispositivos').select('*').eq('id',id).single();if(data){d=data;d.detalhes=(data.detalhes&&typeof data.detalhes==='object')?data.detalhes:{};}}
  const wrap=document.getElementById(_acWrapId(categoria));
  const oldf=document.getElementById('ac-item-form');if(oldf)oldf.remove();
  const tipos=_acTiposFor(categoria);
  const form=document.createElement('div');form.className='ac-card';form.id='ac-item-form';
  form.innerHTML=`<h3 style="margin-top:0">${id?'Editar':'Novo'} ${categoria==='veiculo'?'veículo':'dispositivo'}</h3>
    <div class="ac-grid2">
      <label>Tipo<select class="ac-select" id="aci-tipo">${tipos.map(t=>`<option value="${t[0]}" ${t[0]===d.tipo?'selected':''}>${t[1]}</option>`).join('')}</select></label>
      <label>Identificação / descrição<input class="ac-input" id="aci-desc" value="${_acEsc(d.descricao||'')}"></label>
      <label>Desde<input class="ac-input" id="aci-desde" type="date" value="${_acEsc(d.desde||'')}"></label>
      <label style="grid-column:1/-1">Observação<input class="ac-input" id="aci-obs" value="${_acEsc(d.observacao||'')}"></label>
    </div>
    <div id="aci-dyn" class="ac-grid2" style="margin-top:10px"></div>
    <div style="margin-top:12px;display:flex;gap:8px">
      <button class="ac-btn" id="aci-save">Salvar</button>
      <button class="ac-btn ghost" id="aci-cancel">Cancelar</button>
    </div>`;
  wrap.prepend(form);
  const renderDyn=()=>{
    const tipo=form.querySelector('#aci-tipo').value;
    form.querySelector('#aci-dyn').innerHTML=_acFieldsFor(tipo).map(f=>{
      const val=(d.tipo===tipo&&d.detalhes[f[0]])?d.detalhes[f[0]]:'';
      if(f[0]==='combustivel')return `<label>${_acEsc(f[1])}<select class="ac-select" data-fk="${f[0]}"><option value="">—</option>${AC_COMB.map(o=>`<option ${o===val?'selected':''}>${o}</option>`).join('')}</select></label>`;
      return `<label>${_acEsc(f[1])}<input class="ac-input" data-fk="${f[0]}" value="${_acEsc(val)}"></label>`;
    }).join('');
  };
  renderDyn();
  form.querySelector('#aci-tipo').onchange=renderDyn;
  form.querySelector('#aci-cancel').onclick=()=>_acRenderItens(pessoaId,categoria);
  form.querySelector('#aci-save').onclick=()=>_acSaveItem(pessoaId,categoria,id||null);
}
async function _acSaveItem(pessoaId,categoria,id){
  const form=document.getElementById('ac-item-form');if(!form)return;
  const tipo=form.querySelector('#aci-tipo').value;
  const detalhes={};
  form.querySelectorAll('#aci-dyn [data-fk]').forEach(el=>{const v=el.value.trim();if(v)detalhes[el.dataset.fk]=v;});
  const rec={pessoa_id:pessoaId,categoria,tipo,descricao:form.querySelector('#aci-desc').value.trim(),desde:form.querySelector('#aci-desde').value||null,observacao:form.querySelector('#aci-obs').value.trim()||null,detalhes,atualizado_em:new Date().toISOString()};
  if(!rec.descricao){adminToast('Identificação/descrição é obrigatória',false);return;}
  let err;
  if(id){({error:err}=await sbClient.from('acessos_dispositivos').update(rec).eq('id',id));}
  else{({error:err}=await sbClient.from('acessos_dispositivos').insert(rec));}
  if(err){adminToast('Erro: '+err.message,false);return;}
  await _acLog(id?'item.editar':'item.criar',categoria+':'+rec.descricao,'ok',tipo);
  adminToast('Item salvo');_acRenderItens(pessoaId,categoria);
}
async function _acSetItemStatus(id,pessoaId,categoria,status){
  const{error}=await sbClient.from('acessos_dispositivos').update({status,atualizado_em:new Date().toISOString()}).eq('id',id);
  if(error){adminToast('Erro: '+error.message,false);return;}
  await _acLog('item.status',categoria+':'+id,'ok',status);
  adminToast('Status atualizado');_acRenderItens(pessoaId,categoria);
}
async function _acDelItem(id,pessoaId,categoria){
  if(!confirm('Excluir este item?'))return;
  const{error}=await sbClient.from('acessos_dispositivos').delete().eq('id',id);
  if(error){adminToast('Erro: '+error.message,false);return;}
  await _acLog('item.excluir',categoria+':'+id,'ok',null);
  adminToast('Item excluído');_acRenderItens(pessoaId,categoria);
}
function _acSanitizeName(n){return String(n||'arquivo').replace(/[^\w.\-]+/g,'_').slice(-80);}
async function _acRenderTermos(pessoaId){
  const wrap=document.getElementById('ac-termos-wrap');if(!wrap)return;
  const{data,error}=await sbClient.from('acessos_termos').select('*').eq('pessoa_id',pessoaId).order('enviado_em',{ascending:false});
  if(error){wrap.innerHTML='<div class="ac-card">Erro termos: '+_acEsc(error.message)+'</div>';return;}
  const list=(data||[]).map(t=>`<div class="ac-row">
      <div class="grow">
        <div><strong>${_acEsc(t.titulo||'Documento')}</strong></div>
        <div class="ac-muted">${t.enviado_em?_acEsc(new Date(t.enviado_em).toLocaleDateString('pt-BR')):''}${t.observacao?' · '+_acEsc(t.observacao):''}</div>
      </div>
      <button class="ac-btn ghost" onclick="_acDownloadTermo('${t.id}')">Baixar</button>
      <button class="ac-btn danger" onclick="_acDelTermo('${t.id}','${pessoaId}')">Excluir</button>
    </div>`).join('');
  wrap.innerHTML=`<div class="ac-card">
    <div class="ac-section-h"><h3>Termos / documentos</h3>
      <button class="ac-btn" style="margin-left:auto" onclick="document.getElementById('ac-termo-file').click()">+ Enviar documento</button>
      <input type="file" id="ac-termo-file" style="display:none" accept="application/pdf,image/*" onchange="_acUploadTermo('${pessoaId}',this.files[0])">
    </div>
    ${list||'<div class="ac-muted">Nenhum documento enviado.</div>'}
  </div>`;
}
async function _acUploadTermo(pessoaId,file){
  if(!file)return;
  const titulo=(prompt('Título do documento (opcional):',file.name)||file.name);
  const path=pessoaId+'/'+Date.now()+'-'+_acSanitizeName(file.name);
  const{error:e1}=await sbClient.storage.from('acessos-termos').upload(path,file,{upsert:true,contentType:file.type||'application/octet-stream'});
  if(e1){adminToast('Erro upload: '+e1.message,false);return;}
  const{error:e2}=await sbClient.from('acessos_termos').insert({pessoa_id:pessoaId,titulo,arquivo_path:path});
  if(e2){await sbClient.storage.from('acessos-termos').remove([path]);adminToast('Erro: '+e2.message,false);return;}
  await _acLog('termo.enviar','termo:'+titulo,'ok',null);
  adminToast('Documento enviado');_acRenderTermos(pessoaId);
}
async function _acDownloadTermo(termoId){
  const{data,error}=await sbClient.from('acessos_termos').select('arquivo_path').eq('id',termoId).single();
  if(error||!data?.arquivo_path){adminToast('Arquivo não encontrado',false);return;}
  const{data:sg,error:e2}=await sbClient.storage.from('acessos-termos').createSignedUrl(data.arquivo_path,120);
  if(e2){adminToast('Erro URL: '+e2.message,false);return;}
  window.open(sg.signedUrl,'_blank');
}
async function _acDelTermo(termoId,pessoaId){
  if(!confirm('Excluir este documento?'))return;
  const{data:t}=await sbClient.from('acessos_termos').select('arquivo_path').eq('id',termoId).single();
  if(t&&t.arquivo_path){await sbClient.storage.from('acessos-termos').remove([t.arquivo_path]);}
  const{error}=await sbClient.from('acessos_termos').delete().eq('id',termoId);
  if(error){adminToast('Erro: '+error.message,false);return;}
  await _acLog('termo.excluir','termo:'+termoId,'ok',null);
  adminToast('Documento excluído');_acRenderTermos(pessoaId);
}
let _acAudView=(typeof localStorage!=='undefined'&&localStorage.getItem('ac-aud-view'))||'cards';
let _acAudData=null;
// Recado de "não consegui ver tudo". Fica fora de _acAudData porque é preenchido
// mesmo quando a consulta falha e _acAudData nem chega a existir.
let _acAudAviso=null;
async function _acRenderAuditoria(){
  const body=document.getElementById('ac-body');
  body.innerHTML='<div class="ac-muted">Carregando auditoria…</div>';
  _acAudAviso=null; // recomeça limpo: aviso de carga velha não pode sobrar na nova.
  const[{data:orgs},{data:setores},{data:pessoas},{data:itens},{data:vincs}]=await Promise.all([
    sbClient.from('acessos_organizacoes').select('*').order('ordem').order('nome'),
    sbClient.from('acessos_setores').select('*').order('nome'),
    sbClient.from('acessos_pessoas').select('*').order('nome'),
    sbClient.from('acessos_dispositivos').select('*'),
    sbClient.from('acessos_vinculos').select('pessoa_id,papel,estado,acessos_recursos(nome,tipo,arquivado_em)')
  ]);
  let odMap={},odByName={};
  try{const r=await _acProxy('microsoft.allShares');((r&&r.items)||[]).forEach(it=>{
    const e=(it.email||'').toLowerCase();
    const entry={pasta:it.pasta,role:it.role,isRoot:!!it.isRoot,marca:it.marca||null,inherited:!!it.inherited};
    if(e)(odMap[e]=odMap[e]||[]).push(entry);
    // índice por NOME (displayName do grant) — fallback p/ quando o e-mail cadastrado é um apelido
    // e o acesso caiu noutra conta (ex.: convidou @outlook, conta real @gmail).
    const nm=_acNorm(it.name||'');
    if(nm){if(!odByName[nm])odByName[nm]={email:e,folders:[]};odByName[nm].folders.push(entry);}
  });
  // Pasta que o proxy não conseguiu ler vira aviso na tela, não silêncio.
  if(r&&Array.isArray(r.falhas)&&r.falhas.length){
    _acAudAviso='Não consegui ler o acesso de '+r.falhas.length+' pasta(s) do OneDrive: '+r.falhas.map(f=>f.pasta).join(', ')+'. O que aparece abaixo está incompleto.';
  }
  }catch(e){
  // Este catch era vazio. Quando a chamada inteira falhava, a Auditoria pintava a
  // lista sem NENHUM acesso do OneDrive — igualzinho a "essas pessoas não têm acesso
  // a nada". Quem olhasse ia embora achando que estava tudo limpo. Agora a tela diz
  // que não conseguiu olhar, que é a verdade.
  _acAudAviso='Não consegui consultar os acessos do OneDrive agora ('+(e&&e.message?e.message:'falha na conexão')+'). A coluna do OneDrive abaixo está VAZIA por causa disso — não porque as pessoas não tenham acesso.';
  }
  const setorById={};(setores||[]).forEach(s=>setorById[s.id]=s);
  const itensByP={};(itens||[]).forEach(d=>{(itensByP[d.pessoa_id]=itensByP[d.pessoa_id]||[]).push(d);});
  // Pasta arquivada não conta na Auditoria: ela saiu de uso, então mostrar que
  // "fulano tem acesso" a ela só geraria cobrança de um acesso que não importa
  // mais. O vínculo em si continua no banco (nada foi apagado).
  const iclMap={};(vincs||[]).forEach(v=>{const r=v.acessos_recursos;if(r&&r.tipo==='icloud'&&!r.arquivado_em){(iclMap[v.pessoa_id]=iclMap[v.pessoa_id]||[]).push({pasta:r.nome,papel:v.papel,estado:v.estado});}});
  _acAudData={orgs:orgs||[],setores:setores||[],pessoas:pessoas||[],setorById,itensByP,odMap,odByName,iclMap};
  _acAudPaint();
}
function _acNorm(s){return String(s==null?'':s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim();}
// Reconcilia o e-mail do cadastro p/ a conta REAL do grant (quando casou por nome mas o
// email_outlook era um apelido). Auto-cura registros antigos — não deixa o erro se repetir.
async function _acReconcileEmail(p,email){
  if(!p||!email||(p.email_outlook&&p.email_outlook.toLowerCase()===email.toLowerCase()))return;
  const antigo=p.email_outlook||'(vazio)';
  try{const{error}=await sbClient.from('acessos_pessoas').update({email_outlook:email,atualizado_em:new Date().toISOString()}).eq('id',p.id);
    if(!error){p.email_outlook=email;await _acLog('drive.reconcilia','colab:'+p.nome,'ok',antigo+' → '+email);}
  }catch(e){}
}
function _acAudSetView(v){_acAudView=v;try{localStorage.setItem('ac-aud-view',v);}catch(e){}_acAudPaint();}
function _acAudTog(btn){const l=btn.parentElement.querySelector('.ac-detlist');if(!l)return;const open=l.style.display==='none';l.style.display=open?'block':'none';btn.textContent=open?'ocultar':'detalhar';}
// Consolida o OneDrive na auditoria: quem tem a pasta MATRIZ vira "Acesso ao drive completo";
// quem tem várias pastas do mesmo setor vira "{Setor} · N pastas". Cada grupo tem "detalhar".
function _acOdSummary(od){
  if(!od||!od.length)return '<span class="ac-muted">sem pastas</span>';
  const roots=od.filter(f=>f.isRoot&&!f.inherited);
  const inherited=od.filter(f=>!f.isRoot&&f.inherited);
  const direct=od.filter(f=>!f.isRoot&&!f.inherited);
  const chips=[];
  // 1) drive completo por marca (matriz) — herdadas entram no "detalhar"
  roots.forEach(r=>{const marca=r.marca||r.pasta;
    chips.push({label:'Acesso ao drive completo · '+marca,role:r.role,detail:[r.pasta+' (matriz)'].concat(inherited.map(f=>f.pasta))});});
  // 2) demais: se tem matriz, herdadas já foram pro detalhe; senão agrupa herdadas+diretas por setor
  const toGroup=roots.length?direct:direct.concat(inherited);
  const bySec={};
  toGroup.forEach(f=>{const sec=(typeof _acDriveClassify==='function')?_acDriveClassify(f.pasta):{label:'Outros'};(bySec[sec.label]=bySec[sec.label]||[]).push(f);});
  Object.keys(bySec).sort().forEach(secLabel=>{const fs=bySec[secLabel];
    if(fs.length>=2)chips.push({label:secLabel+' · '+fs.length+' pastas',role:fs.some(x=>x.role==='edição')?'edição':'leitura',detail:fs.map(f=>f.pasta)});
    else chips.push({label:fs[0].pasta,role:fs[0].role,detail:null});});
  return chips.map(c=>{
    const det=c.detail?' <button class="ac-detbtn" type="button" onclick="_acAudTog(this)">detalhar</button><div class="ac-detlist" style="display:none">'+c.detail.map(d=>'• '+_acEsc(d)).join('<br>')+'</div>':'';
    return '<div class="ac-od-chip"><b>'+_acEsc(c.label)+'</b> <span class="ac-pill '+(c.role==='edição'?'warn':'ok')+'">'+_acEsc(c.role)+'</span>'+det+'</div>';
  }).join('');
}
function _acAudPaint(){
  const body=document.getElementById('ac-body');if(!body||!_acAudData)return;
  const {orgs,setores,pessoas,setorById,itensByP,odMap,odByName,iclMap}=_acAudData;
  const orgName=id=>{const o=orgs.find(x=>x.id===id);return o?o.nome:null;};
  const tree={};
  pessoas.forEach(p=>{
    const s=p.setor_id?setorById[p.setor_id]:null;
    const orgId=p.organizacao_id||(s&&s.organizacao_id)||'__none__';
    const orgN=orgId==='__none__'?'Sem organização':(orgName(orgId)||'Sem organização');
    const setorKey=p.setor_id||'__nosetor__';
    const setorN=s?s.nome:'Sem setor';
    tree[orgId]=tree[orgId]||{nome:orgN,setores:{}};
    tree[orgId].setores[setorKey]=tree[orgId].setores[setorKey]||{nome:setorN,list:[]};
    tree[orgId].setores[setorKey].list.push(p);
  });
  const line=(logo,rot,val)=>`<div class="ac-aud-line"><span class="ac-kicker">${logo||''}${rot}</span> <span>${val}</span></div>`;
  const odOf=p=>{
    const byEmail=(p.email_outlook?odMap[p.email_outlook.toLowerCase()]:null);
    if(byEmail&&byEmail.length)return byEmail;
    // fallback por NOME: o acesso pode ter caído numa conta diferente do e-mail cadastrado (apelido)
    const nm=_acNorm(p.nome||'');
    const byName=nm&&odByName?odByName[nm]:null;
    if(byName&&byName.folders.length){
      if(byName.email)_acReconcileEmail(p,byName.email); // auto-cura o cadastro (assíncrono)
      return byName.folders;
    }
    return [];
  };
  const inPoss=d=>(d.status==='em_uso'||d.status==='a_devolver');
  const dispOf=p=>(itensByP[p.id]||[]).filter(d=>d.categoria!=='veiculo'&&inPoss(d));
  const veicOf=p=>(itensByP[p.id]||[]).filter(d=>d.categoria==='veiculo'&&inPoss(d));
  const orgNomeOf=p=>{const s=p.setor_id?setorById[p.setor_id]:null;return p.organizacao_id?orgName(p.organizacao_id):(s&&s.organizacao_id?orgName(s.organizacao_id):null);};
  const item=(logo,k,v)=>`<div class="ac-aud-item"><div class="ac-aud-k">${logo||''}${k}</div><div class="ac-aud-v">${v}</div></div>`;
  const card=p=>{
    const od=odOf(p),icl=iclMap[p.id]||[],disp=dispOf(p),veic=veicOf(p),orgN=orgNomeOf(p);
    return `<div class="ac-card ac-audcard">
      <div class="ac-aud-hd">${_acAvatar(p,44)}
        <div class="grow" style="min-width:0"><div class="ac-person-name">${_acEsc(p.nome)} ${p.status==='desligado'?'<span class="ac-pill neutral">desligado</span>':''}</div>
          <div class="ac-kicker">${_acEsc(p.cargo||'—')}${orgN?' · '+_acEsc(orgN):''}</div></div></div>
      ${item(_acLogo('zoho'),'Zoho',p.email_corporativo?_acEsc(p.email_corporativo):'<span class="ac-muted">—</span>')}
      ${item(_acLogo('ms'),'OneDrive',_acOdSummary(od))}
      ${item(_acLogo('apple'),'iCloud',icl.length?icl.map(f=>_acEsc(f.pasta)+' <span class="ac-muted">('+(f.papel==='edicao'?'edição':'leitura')+(f.estado==='pendente'?' · pendente':'')+')</span>').join(', '):'<span class="ac-muted">sem pastas</span>')}
      ${item(_acLogo('apple'),'Apple',p.conta_apple?_acEsc(p.conta_apple):'<span class="ac-muted">—</span>')}
      ${item('','Dispositivos',disp.length?disp.map(d=>_acEsc(_acItemTipoLabel(d.tipo))+(d.descricao?' '+_acEsc(d.descricao):'')).join(', '):'<span class="ac-muted">nenhum</span>')}
      ${item('','Patrimônio',veic.length?veic.map(d=>_acEsc(d.descricao||_acItemTipoLabel(d.tipo))).join(', '):'<span class="ac-muted">nenhum</span>')}
    </div>`;
  };
  const listRow=p=>{
    const od=odOf(p),icl=iclMap[p.id]||[],disp=dispOf(p),veic=veicOf(p),orgN=orgNomeOf(p);
    const cnt=(logo,n,v)=>`<span class="ac-cnt ${v?'':'zero'}">${logo||''}${n} ${v}</span>`;
    return `<div class="ac-audrow">${_acAvatar(p,40)}
      <div class="grow" style="min-width:0"><div class="ac-person-name">${_acEsc(p.nome)} ${p.status==='desligado'?'<span class="ac-pill neutral">desligado</span>':''}</div>
        <div class="ac-kicker">${_acEsc(p.cargo||'—')}${orgN?' · '+_acEsc(orgN):''}</div>
        ${p.email_corporativo?`<div class="ac-person-email">${_acEsc(p.email_corporativo)}</div>`:''}</div>
      <div class="ac-audrow-counts">${cnt(_acLogo('ms'),'OneDrive',od.length)}${cnt(_acLogo('apple'),'iCloud',icl.length)}${cnt('','Disp',disp.length)}${cnt('','Patrim',veic.length)}</div>
      <button class="ac-btn ghost" onclick="_acOpenPessoa('${p.id}')">Abrir →</button>
    </div>`;
  };
  const orgOrder=orgs.map(o=>o.id).concat(['__none__']);
  const blocos=orgOrder.filter(k=>tree[k]).map(k=>{
    const org=tree[k];
    const setoresHtml=Object.keys(org.setores).map(sk=>{
      const st=org.setores[sk];
      const inner=_acAudView==='lista'?st.list.map(listRow).join(''):('<div class="ac-aud-grid">'+st.list.map(card).join('')+'</div>');
      return `<div class="ac-aud-setor">${_acEsc(st.nome)} <span class="ac-muted" style="text-transform:none;letter-spacing:0">(${st.list.length})</span></div>${inner}`;
    }).join('');
    return `<div style="margin-bottom:26px"><div class="ac-section-h"><h3>${_acEsc(org.nome)}</h3></div>${setoresHtml}</div>`;
  }).join('');
  const toggle=`<div class="ac-section-h"><h3>Auditoria</h3><div style="margin-left:auto;display:flex;gap:6px"><button class="ac-tab ${_acAudView==='cards'?'active':''}" onclick="_acAudSetView('cards')">Cards</button><button class="ac-tab ${_acAudView==='lista'?'active':''}" onclick="_acAudSetView('lista')">Lista</button></div></div>`;
  // O aviso vem ANTES da lista de propósito: se o quadro está incompleto, quem lê
  // precisa saber disso antes de tirar conclusão do que está abaixo.
  const aviso=_acAudAviso?'<div class="ac-aviso-incompleto">⚠ '+_acEsc(_acAudAviso)+'</div>':'';
  body.innerHTML=aviso+toggle+(blocos||'<div class="ac-muted">Sem colaboradores.</div>');
}

// Estas funções manipulam o DOM diretamente (innerHTML/onclick strings), então
// precisam existir em window para os handlers embutidos nas strings HTML
// funcionarem (mesma técnica de window._npSetView em tela-de-noticias.vue).
Object.assign(window, {
  _acAddOrg, _acAddSetor, _acAudPaint, _acAudSetView, _acAudTog, _acAvatar, _acCatTitulo, _acColabPicker,
  _acConectarOneDrive, _acConectarZoho, _acCopy, _acCopyFallback, _acDelItem, _acDelOrg, _acDelSetor, _acDelTermo,
  _acDesligar, _acDownloadTermo, _acDriveAddMarca, _acDriveAddSetor, _acDriveAllSectors, _acDriveBuildTree, _acDriveClassify, _acDriveDelMarca,
  _acDriveDelSetor, _acDriveDragEnd, _acDriveDragLeave, _acDriveDragOver, _acDriveDragStart, _acDriveDrop, _acDriveExplode, _acDriveFlowNode,
  _acDriveFlowTog, _acDriveFolderCard, _acDriveLabelOf, _acDriveLegend, _acDriveLiberarSetor, _acDriveMove, _acDrivePaintShell, _acDriveRenderFlow,
  _acDriveRepaint, _acDriveSecColor, _acDriveSectorOf, _acDriveSelectMarca, _acDriveSetDepth, _acDriveSetView, _acDriveShare, _acDriveToggleSec,
  _acDriveWire, _acDstMeta, _acEsc, _acExcluirColaborador, _acFieldsFor, _acFixAliases, _acFormColaborador, _acFormItem,
  _acFormSetorOpts, _acHandleZohoReturn, _acICAcessos, _acICAddAcesso, _acICAddFolder, _acICLoadFolders, _acICRemoveAcesso, _acICRemoveFolder,
  _acICToggleAcessos, _acICToggleFeito, _acImportarZoho, _acItemTipoLabel, _acLog, _acLogo, _acNorm, _acODAdd,
  _acODBrowse, _acODLoadFolders, _acODOpen, _acODPickColab, _acODPicker, _acODRemoveFolder, _acODShare, _acODShares,
  _acODStatus, _acOdSummary, _acODToggleShares, _acODUnshare, _acODUp, _acOpenICloud, _acOpenOneDrive, _acOpenOrg,
  _acOpenPessoa, _acOpenSetor, _acOrgIco, _acPickAll, _acPickCount, _acPickFilter, _acProvisionar, _acProxy,
  _acReativar, _acReconcileEmail, _acRender, _acRenderAuditoria, _acRenderColaboradores, _acRenderConfiguracoes, _acRenderDispositivos, _acRenderDrive,
  _acRenderFicha, _acRenderICloud, _acRenderItens, _acRenderOneDrive, _acRenderOrganizacoes, _acRenderSetores, _acRenderTermos, _acRenderVeiculos,
  _acSanitizeName, _acSaveColaborador, _acSaveItem, _acSetItemStatus, _acSetorIco, _acSetTab, _acTiposFor, _acToggleOrg, _acVoltarSel,
  _acUploadAvatar, _acUploadTermo, _acWrapId, _acZohoStatus,
  _acDriveSetProvedor, _acDriveProvedorBar, _acRenderWorkdrive, _acWdCarregarPastas, _acWdRepaint,
  _acWdNo, _acWdAlternar, _acWdImportar
})

// ==========================================================================
// TOPO (Tarefa 2 do redesign): preencher status dos provedores + números dos
// KPIs. Estas funções mexem em elementos que já existem no <template> (têm id),
// só trocando texto/classe — por isso NÃO precisam ir pra window (ninguém as
// chama de dentro de string HTML; quem chama é o onMounted, aqui do escopo).
// Tudo é "à prova de erro": se uma consulta falhar, mostra um aviso honesto no
// próprio lugar em vez de derrubar a tela.
// ==========================================================================

// Pinta a bolinha de status de UM provedor que tem status real (Zoho ou
// Microsoft). Verde = conectado, âmbar = não conectado, cinza = deu erro ao
// perguntar (aí escreve "status indisponível", nunca fica mudo).
async function _acTopoStatusProvedor(action, dotId, noteId, pillId) {
  const dot = document.getElementById(dotId)
  if (!dot) return
  const note = noteId ? document.getElementById(noteId) : null
  const pill = pillId ? document.getElementById(pillId) : null
  try {
    const s = await _acProxy(action)
    const conectado = !!(s && s.connected)
    dot.className = 'ac-hero-dot ' + (conectado ? 'on' : 'leg')
    if (note) note.textContent = conectado ? 'conectado' : 'não conectado'
    if (pill) pill.title = conectado ? 'Conectado' : 'Não conectado — reconecte nas Configurações'
  } catch (e) {
    dot.className = 'ac-hero-dot off'
    if (note) note.textContent = 'status indisponível'
    if (pill) pill.title = 'Não foi possível verificar a conexão agora'
  }
}

// Preenche a faixa de 4 KPIs com números REAIS do banco. Cada KPI é
// independente: se um falhar, os outros ainda aparecem, e o que falhou mostra
// "—" com um title explicando — melhor um traço honesto que um número errado.
async function _acTopoKpis() {
  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v }
  const setTitle = (id, t) => { const el = document.getElementById(id); if (el && t != null) el.title = t }

  // KPI 1 — Pastas geridas: quantas pastas ATIVAS (arquivado_em vazio) estão
  // sob controle, separadas por provedor. Uma consulta só, trazendo apenas a
  // coluna "tipo" (barato), e a conta é feita aqui no navegador.
  try {
    const { data, error } = await sbClient
      .from('acessos_recursos')
      .select('tipo')
      .is('arquivado_em', null)
    if (error) throw error
    const linhas = data || []
    const c = { workdrive: 0, onedrive: 0, icloud: 0 }
    linhas.forEach(r => { if (c[r.tipo] != null) c[r.tipo]++ })
    setText('ac-kpi-pastas', String(linhas.length))
    setText('ac-kpi-pastas-fine', montarDetalhePastas(c))
  } catch (e) {
    setText('ac-kpi-pastas', '—')
    setText('ac-kpi-pastas-fine', 'não foi possível contar as pastas agora')
  }

  // KPI 2 — Pessoas com acesso: colaboradores com status "ativo". COUNT no
  // banco (head:true = só o número, não traz as linhas).
  try {
    const { count, error } = await sbClient
      .from('acessos_pessoas')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ativo')
    if (error) throw error
    setText('ac-kpi-pessoas', String(count != null ? count : 0))
  } catch (e) {
    setText('ac-kpi-pessoas', '—')
  }

  // KPI 3 — Compartilhamentos: mostra o número REAL de acessos ativos no OneDrive.
  //
  // A tentação seria contar acessos_vinculos (1 COUNT barato no nosso banco), mas
  // essa tabela só tem 1 linha (medido) — mostraria "1" onde a verdade são ~370.
  // Um card de KPI se lê como manchete: número errado ali é mentira, não economia.
  // Então buscamos o número verdadeiro ao vivo (a mesma consulta que a Auditoria já
  // faz). Custa alguns segundos, então é PREGUIÇOSO: o card já apareceu com "…" e a
  // gente troca pelo número quando ele chega, sem travar o resto da tela.
  try {
    const r = await _acProxy('microsoft.allShares')
    const itens = (r && Array.isArray(r.items)) ? r.items : null
    if (itens == null) throw new Error('resposta_sem_items')
    setText('ac-kpi-shares', String(itens.length))
    // Se alguma pasta não pôde ser lida, o número é PARCIAL — dizer isso, não fingir total.
    const falhas = (r && Array.isArray(r.falhas)) ? r.falhas.length : 0
    if (falhas > 0) {
      setText('ac-kpi-shares-fine', `acessos no OneDrive (parcial: ${falhas} pasta(s) não lida(s))`)
      setTitle('ac-kpi-shares', 'Faltou ler ' + falhas + ' pasta(s); o número está incompleto')
    } else {
      setText('ac-kpi-shares-fine', 'acessos ativos no OneDrive (ao vivo)')
    }
  } catch (e) {
    setText('ac-kpi-shares', '—')
    setText('ac-kpi-shares-fine', 'não foi possível consultar o OneDrive agora')
    setTitle('ac-kpi-shares', 'A consulta ao OneDrive falhou; o número não é zero, é desconhecido')
  }
}

// Equivalente ao openAcessos() do legado, menos o display:flex (o router faz)
// e a checagem de tela home: guarda de permissão + reset de estado + carga.
onMounted(() => {
  if (!hasPermission('tool:acessos')) {
    adminToast('Sem acesso', false)
    router.push({ name: 'inicio' })
    return
  }
  _acTab = 'org'; _acSel = null; _acSelSetor = null; _acSelOrg = null
  loadAcessos()
  // O topo carrega em paralelo, sem travar o corpo da tela. Cada chamada já
  // trata o próprio erro por dentro, então não precisa de try/catch aqui.
  _acTopoStatusProvedor('zoho.status', 'ac-prov-zoho', 'ac-prov-zoho-note', 'ac-prov-zoho-pill')
  _acTopoStatusProvedor('microsoft.status', 'ac-prov-ms', 'ac-prov-ms-note', 'ac-prov-ms-pill')
  _acTopoKpis()
})
</script>

<style scoped>
/* CSS "peeled" (movido, não copiado) de src/estilos/estilos-globais.css —
   as regras do bloco "Controle de Acessos" (linhas 907-1262 daquele arquivo,
   idênticas a legacy/index.html L931-1286) foram removidas de lá e movidas
   para cá, igual ao que foi feito com #noticias-screen em tela-de-noticias.vue.
   O root do componente mantém id="acessos-screen" + class="tela-acessos";
   os seletores CSS foram convertidos de "#acessos-screen" para ".tela-acessos"
   (inclusive os que no legado eram soltos, tipo ".ac-topbar{...}" sem prefixo —
   só são usados nesta tela mesmo). Como o conteúdo de #ac-body é 100% montado
   via innerHTML/createElement (não pelo template do Vue), os seletores
   descendentes ".ac-*" foram envolvidos em :deep(...) para o estilo alcançar
   esses elementos criados em runtime. As regras de raiz (".tela-acessos{...}",
   "[data-theme=dark] .tela-acessos{...}") ficam sem :deep porque miram o
   próprio elemento raiz do componente.
   Adaptação: o root no legado era display:none + position:fixed;inset:0;z-index:50
   (overlay empilhado sobre #home-screen, alternado via JS). No Vue quem decide
   se a tela existe é o vue-router (troca de rota = troca de página inteira,
   sem pilha de overlays) — por isso virou display:flex + min-height:100vh +
   position:relative;z-index:1, no mesmo padrão de tela-inicial.vue/tela-de-login.vue.
   NOTA: .ac-toggle/.ac-toggle-track/.ac-toggle-thumb/.ac-toggle-lbl (auto-cycle de
   perfis, legacy/index.html L108-114/219-220/364) NÃO pertencem a este módulo —
   "ac-" ali é abreviação de "auto-cycle", colisão de prefixo com "acessos";
   permanecem em estilos-globais.css, intocados. */
  /* ===== Controle de Acessos ===== */
.tela-acessos{display:flex;flex-direction:column;min-height:100vh;position:relative;z-index:1;background:var(--bg,#0b0f14)}
.tela-acessos :deep(.ac-topbar){display:flex;align-items:center;gap:18px;padding:16px 24px;border-bottom:1px solid rgba(255,255,255,.08);position:sticky;top:0;background:inherit;flex-wrap:wrap}
.tela-acessos :deep(.ac-back){background:none;border:1px solid rgba(255,255,255,.18);color:inherit;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:13px}
.tela-acessos :deep(.ac-tabs){display:flex;gap:6px;margin-left:auto}
.tela-acessos :deep(.ac-tab){background:none;border:1px solid rgba(255,255,255,.14);color:inherit;border-radius:8px;padding:6px 14px;cursor:pointer;font-size:13px}
.tela-acessos :deep(.ac-tab.active){background:#0d9488;border-color:#0d9488;color:#fff}
.tela-acessos :deep(.ac-body){padding:20px clamp(14px,2.4vw,44px);width:100%}

/* ===== TOPO do redesign (Tarefa 2): cabeçalho + faixa de KPIs =====
   Estes elementos são markup ESTÁTICO do <template> (não montados por
   innerHTML), então o CSS scoped normal já os alcança — por isso aqui NÃO
   usamos :deep (diferente do resto do arquivo, que estiliza DOM criado em
   runtime). Toda cor sai de var(--...) de estilos-globais.css pra funcionar
   igual no tema claro E no escuro; o mockup tinha as cores cravadas, aqui
   estão traduzidas pros tokens. */
.tela-acessos .ac-topo{padding:clamp(16px,2.2vw,26px) clamp(14px,2.4vw,44px) 0;width:100%}
.tela-acessos .ac-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:18px}
.tela-acessos .ac-hero-brand{display:flex;align-items:center;gap:12px;min-width:0}
.tela-acessos .ac-hero-mark{width:38px;height:38px;border-radius:10px;flex:none;display:grid;place-items:center;color:#fff;font-weight:800;font-size:16px;letter-spacing:.5px;background:linear-gradient(135deg,var(--accent),color-mix(in srgb,var(--accent) 72%,#000));box-shadow:var(--shadow-sm)}
.tela-acessos .ac-hero-h1{margin:0;font-family:'Oswald',sans-serif;font-size:clamp(19px,2.3vw,25px);font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--text);line-height:1.05}
.tela-acessos .ac-hero-sub{color:var(--muted);font-size:12.5px;margin-top:3px;line-height:1.35}
.tela-acessos .ac-hero-provs{display:flex;gap:8px;flex-wrap:wrap}
.tela-acessos .ac-hero-prov{display:flex;align-items:center;gap:7px;padding:7px 12px;border:1px solid var(--border);border-radius:999px;background:var(--surface);font-size:12.5px;font-weight:600;color:var(--text);box-shadow:var(--shadow-sm)}
.tela-acessos .ac-hero-prov-note{color:var(--muted);font-weight:500;font-size:11.5px}
.tela-acessos .ac-hero-prov-note:empty{display:none}
.tela-acessos .ac-hero-dot{width:8px;height:8px;border-radius:999px;flex:none;background:var(--muted)}
.tela-acessos .ac-hero-dot.on{background:var(--green);box-shadow:0 0 0 3px color-mix(in srgb,var(--green) 20%,transparent)}
.tela-acessos .ac-hero-dot.leg{background:var(--orange);box-shadow:0 0 0 3px color-mix(in srgb,var(--orange) 20%,transparent)}
.tela-acessos .ac-hero-dot.off{background:var(--muted);box-shadow:0 0 0 3px color-mix(in srgb,var(--muted) 18%,transparent)}
.tela-acessos .ac-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:4px}
.tela-acessos .ac-kpi{position:relative;overflow:hidden;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px 18px;box-shadow:var(--shadow-sm)}
.tela-acessos .ac-kpi-rail{position:absolute;left:0;top:0;bottom:0;width:3px}
.tela-acessos .ac-kpi.k1 .ac-kpi-rail{background:var(--accent)}
.tela-acessos .ac-kpi.k2 .ac-kpi-rail{background:var(--green)}
.tela-acessos .ac-kpi.k3 .ac-kpi-rail{background:var(--orange)}
.tela-acessos .ac-kpi.k4 .ac-kpi-rail{background:var(--muted)}
.tela-acessos .ac-kpi-lab{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:600}
.tela-acessos .ac-kpi-val{font-family:'Oswald',sans-serif;font-size:32px;font-weight:600;letter-spacing:.5px;line-height:1;margin-top:7px;color:var(--text);font-variant-numeric:tabular-nums}
.tela-acessos .ac-kpi-fine{font-size:12px;color:var(--muted);margin-top:6px;line-height:1.35}
/* No celular os 4 KPIs viram 2 colunas (não estoura a tela) e o cabeçalho
   empilha marca em cima, pills embaixo. */
@media(max-width:720px){
  .tela-acessos .ac-kpis{grid-template-columns:repeat(2,1fr)}
  .tela-acessos .ac-hero{align-items:flex-start}
  .tela-acessos .ac-hero-provs{width:100%}
}
@media(max-width:420px){
  .tela-acessos .ac-kpi-val{font-size:27px}
}
.tela-acessos :deep(.ac-aud-grid){display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:14px}
.tela-acessos :deep(.ac-aud-line){margin-top:5px;font-size:13px}
.tela-acessos :deep(.ac-aud-line .ac-kicker){display:inline}
.tela-acessos :deep(.ac-card){border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:16px;margin-bottom:14px}
.tela-acessos :deep(.ac-row){display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid rgba(255,255,255,.08);border-radius:10px;margin-bottom:8px;flex-wrap:wrap}
.tela-acessos :deep(.ac-row .grow){flex:1;min-width:160px}
.tela-acessos :deep(.ac-muted){opacity:.6;font-size:12px}
/* Aviso de "o quadro abaixo está incompleto".
   Usa var(--orange) e não cor cravada porque o painel tem tema claro E escuro:
   cor fixa ficaria ilegível num dos dois. Precisa de :deep() porque a Auditoria
   é desenhada com innerHTML, e CSS scoped não alcança elemento injetado assim. */
.tela-acessos :deep(.ac-aviso-incompleto){
  margin:0 0 var(--sp-3);padding:10px 14px;
  border:1px solid var(--orange);border-left-width:4px;
  border-radius:var(--radius-md);
  background:color-mix(in srgb, var(--orange) 8%, transparent);
  color:var(--orange);font-size:13px;line-height:1.45;font-weight:600;
}
.tela-acessos :deep(.ac-btn){background:#0d9488;border:none;color:#fff;border-radius:8px;padding:7px 14px;cursor:pointer;font-size:13px}
.tela-acessos :deep(.ac-btn.ghost){background:none;border:1px solid rgba(255,255,255,.18);color:inherit}
.tela-acessos :deep(.ac-btn.danger){background:#991b1b}
.tela-acessos :deep(.ac-input), .tela-acessos :deep(.ac-select), .tela-acessos :deep(.ac-textarea){background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.16);color:inherit;border-radius:8px;padding:8px 10px;font-size:13px;width:100%}
.tela-acessos :deep(.ac-textarea){min-height:160px;font-family:ui-monospace,monospace}
.tela-acessos :deep(.ac-grid2){display:grid;grid-template-columns:1fr 1fr;gap:10px}
.tela-acessos :deep(.ac-pill){display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:600}
.tela-acessos :deep(.ac-pill.ok){background:rgba(13,148,136,.2);color:#2dd4bf}
.tela-acessos :deep(.ac-pill.warn){background:rgba(245,158,11,.18);color:#fbbf24}
.tela-acessos :deep(.ac-pill.bad){background:rgba(239,68,68,.18);color:#f87171}
  @media(max-width:640px){.tela-acessos :deep(.ac-grid2){grid-template-columns:1fr}.tela-acessos :deep(.ac-tabs){width:100%;margin-left:0}}
  @keyframes acFadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.tela-acessos :deep(.ac-card), .tela-acessos :deep(.ac-setor-card), .tela-acessos :deep(.ac-tile){animation:acFadeUp .32s ease both}
.tela-acessos :deep(.ac-topbar){backdrop-filter:saturate(140%) blur(8px);background:linear-gradient(180deg,rgba(13,148,136,.10),transparent)}
.tela-acessos :deep(.ac-card){transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease;background:linear-gradient(180deg,rgba(255,255,255,.025),rgba(255,255,255,.01))}
.tela-acessos :deep(.ac-card:hover){border-color:rgba(13,148,136,.35)}
.tela-acessos :deep(.ac-btn){transition:transform .12s ease,filter .15s ease,box-shadow .15s ease;box-shadow:0 1px 0 rgba(0,0,0,.15)}
.tela-acessos :deep(.ac-btn:hover){filter:brightness(1.08);transform:translateY(-1px)}
.tela-acessos :deep(.ac-btn:active){transform:translateY(0)}
.tela-acessos :deep(.ac-row){transition:border-color .15s ease,background .15s ease}
.tela-acessos :deep(.ac-row:hover){border-color:rgba(13,148,136,.28);background:rgba(13,148,136,.04)}
.tela-acessos :deep(.ac-setores-grid){display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px}
.tela-acessos :deep(.ac-setor-card){position:relative;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:18px;cursor:pointer;overflow:hidden;background:linear-gradient(155deg,rgba(13,148,136,.10),rgba(255,255,255,.02))}
.tela-acessos :deep(.ac-setor-card::before){content:"";position:absolute;inset:0;background:radial-gradient(120% 80% at 100% 0%,rgba(13,148,136,.18),transparent 60%);opacity:.7;pointer-events:none}
.tela-acessos :deep(.ac-setor-card:hover){transform:translateY(-3px);border-color:rgba(13,148,136,.5);box-shadow:0 12px 28px -12px rgba(13,148,136,.5)}
.tela-acessos :deep(.ac-setor-ico){width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0f766e,#0d9488);color:#fff;margin-bottom:12px}
.tela-acessos :deep(.ac-setor-nome){font-weight:700;font-size:15px;position:relative}
.tela-acessos :deep(.ac-setor-sub){font-size:12px;opacity:.6;margin-top:2px;position:relative}
.tela-acessos :deep(.ac-count){display:inline-flex;align-items:center;gap:5px;margin-top:12px;padding:3px 10px;border-radius:999px;background:rgba(13,148,136,.18);color:#2dd4bf;font-size:12px;font-weight:700;position:relative}
.tela-acessos :deep(.ac-setor-del){position:absolute;top:10px;right:10px;width:26px;height:26px;border-radius:8px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.25);color:#f87171;cursor:pointer;opacity:0;transition:opacity .15s ease;display:flex;align-items:center;justify-content:center;font-size:14px;line-height:1}
.tela-acessos :deep(.ac-setor-card:hover .ac-setor-del){opacity:1}
.tela-acessos :deep(.ac-pill.neutral){background:rgba(148,163,184,.18);color:#cbd5e1}
.tela-acessos :deep(.ac-chip){display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border-radius:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);font-size:11px;margin:2px 4px 2px 0}
.tela-acessos :deep(.ac-modal-ov){position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(3px);display:none;align-items:center;justify-content:center;z-index:60;padding:20px}
.tela-acessos :deep(.ac-modal-ov.open){display:flex;animation:acFadeUp .2s ease both}
.tela-acessos :deep(.ac-modal){background:var(--surface,#0f1720);color:var(--text,#e2e4f0);border:1px solid var(--border,rgba(255,255,255,.12));border-radius:16px;padding:22px;max-width:480px;width:100%;box-shadow:0 24px 60px -20px #000}
.tela-acessos :deep(.ac-section-h){display:flex;align-items:center;gap:10px;margin:0 0 14px}
.tela-acessos :deep(.ac-section-h h3){margin:0}
/* ===== Acessos — profundidade + tema claro/escuro via variáveis ===== */
.tela-acessos{background:var(--surface2)}
[data-theme="dark"] .tela-acessos{background:var(--bg)}
/* ===== Acessos — lista de colaboradores premium ===== */
.tela-acessos :deep(.ac-person){padding:13px 14px;gap:14px}
.tela-acessos :deep(.ac-person .ac-avatar){box-shadow:var(--shadow-sm)}
.tela-acessos :deep(.ac-person-name){font-family:'Playfair Display',serif;font-size:19px;font-weight:600;color:var(--text);letter-spacing:0;display:flex;align-items:center;gap:10px;flex-wrap:wrap;line-height:1.15}
.tela-acessos :deep(.ac-kicker){font-family:'IBM Plex Sans',sans-serif;font-size:9.5px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:var(--muted);margin-top:4px}
.tela-acessos :deep(.ac-person-email){font-family:'IBM Plex Sans',sans-serif;font-size:12.5px;color:var(--muted);margin-top:3px}
/* ===== Acessos — tipografia premium (Oswald + Playfair + IBM Plex, alinhado ao app) ===== */
.tela-acessos :deep(.ac-title){font-family:'Oswald',sans-serif;font-weight:600;font-size:19px;letter-spacing:.8px;text-transform:uppercase;color:var(--text)}
.tela-acessos :deep(.ac-tab){font-family:'IBM Plex Sans',sans-serif;font-size:11px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase}
.tela-acessos :deep(.ac-section-h){align-items:center;gap:12px;margin-bottom:18px;padding-bottom:12px;border-bottom:1px solid var(--border)}
.tela-acessos :deep(.ac-section-h h3){font-family:'Oswald',sans-serif;font-weight:600;font-size:16px;letter-spacing:.7px;text-transform:uppercase;color:var(--text)}
.tela-acessos :deep(.ac-section-h h2){font-family:'Playfair Display',serif;font-weight:800;font-size:clamp(22px,3vw,30px);letter-spacing:-.01em;line-height:1.05;text-transform:none;color:var(--text)}
.tela-acessos :deep(.ac-card h3){font-family:'Oswald',sans-serif;font-weight:600;font-size:15px;letter-spacing:.6px;text-transform:uppercase;color:var(--text)}
.tela-acessos :deep(.ac-card){border-left:3px solid transparent;border-radius:14px;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
.tela-acessos :deep(.ac-card:hover){border-left-color:#0d9488}
.tela-acessos :deep(.ac-setor-nome){font-family:'Oswald',sans-serif;font-weight:600;font-size:18px;letter-spacing:.5px;text-transform:uppercase;color:var(--text)}
.tela-acessos :deep(.ac-setor-sub){font-family:'IBM Plex Sans',sans-serif;font-size:10px;font-weight:600;letter-spacing:1.6px;text-transform:uppercase;color:var(--muted);margin-top:5px}
.tela-acessos :deep(.ac-count){font-family:'Oswald',sans-serif;font-size:13px;font-weight:500;letter-spacing:.6px;font-variant-numeric:tabular-nums}
.tela-acessos :deep(.ac-row strong){font-weight:600;letter-spacing:.2px}
.tela-acessos :deep(.ac-pill){font-family:'IBM Plex Sans',sans-serif;font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase}
.tela-acessos :deep(.ac-chip){font-family:'IBM Plex Sans',sans-serif;letter-spacing:.2px}
.tela-acessos :deep(.ac-btn){font-family:'IBM Plex Sans',sans-serif;font-weight:600;letter-spacing:.3px}
.tela-acessos :deep(.ac-input), .tela-acessos :deep(.ac-select), .tela-acessos :deep(.ac-textarea){font-family:'IBM Plex Sans',sans-serif}
.tela-acessos :deep(.ac-topbar){border-bottom:1px solid var(--border);background:var(--surface);box-shadow:var(--shadow-sm)}
.tela-acessos :deep(.ac-title){color:var(--text)}
.tela-acessos :deep(.ac-back), .tela-acessos :deep(.ac-tab), .tela-acessos :deep(.ac-btn.ghost){border:1px solid var(--border);color:var(--text);background:var(--surface)}
.tela-acessos :deep(.ac-back:hover), .tela-acessos :deep(.ac-tab:hover), .tela-acessos :deep(.ac-btn.ghost:hover){border-color:var(--accent-mid);box-shadow:var(--shadow-sm)}
.tela-acessos :deep(.ac-tab.active){background:#0d9488;border-color:#0d9488;color:#fff}
.tela-acessos :deep(.ac-card){background:var(--surface);border:1px solid var(--border);box-shadow:var(--shadow-md);border-left:3px solid transparent}
.tela-acessos :deep(.ac-card:hover){border-color:var(--accent-mid);box-shadow:var(--shadow-lg)}
.tela-acessos :deep(.ac-row){background:var(--surface);border:1px solid var(--border);box-shadow:var(--shadow-sm)}
.tela-acessos :deep(.ac-row:hover){border-color:rgba(13,148,136,.45);box-shadow:var(--shadow-md)}
/* ===== Acessos — Fase 1: abertura expandida + mobile real ===== */
.tela-acessos :deep(.ac-hero){display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:22px}
.tela-acessos :deep(.ac-hero h2){font-family:'Playfair Display',serif;font-weight:800;font-size:clamp(24px,4vw,34px);line-height:1.02;letter-spacing:-.01em;color:var(--text);margin:0}
.tela-acessos :deep(.ac-hero .ac-sub){font-family:'IBM Plex Sans',sans-serif;font-size:13px;color:var(--muted);margin-top:5px}
.tela-acessos :deep(.ac-hero-actions){margin-left:auto;display:flex;gap:10px;flex-wrap:wrap}
.tela-acessos :deep(.ac-btn.lg){padding:11px 18px;font-size:14px;border-radius:10px}
.tela-acessos :deep(.ac-btn.primary){background:linear-gradient(135deg,#0f766e,#0d9488);color:#fff;border:none;box-shadow:0 6px 18px -8px rgba(13,148,136,.7)}
.tela-acessos :deep(.ac-btn.primary:hover){border:none}
.tela-acessos :deep(.ac-org-block){margin-bottom:18px;border:1px solid var(--border);border-radius:18px;background:var(--surface);box-shadow:var(--shadow-md);overflow:hidden;animation:acFadeUp .32s ease both}
.tela-acessos :deep(.ac-org-head){display:flex;align-items:center;gap:14px;padding:16px 18px;cursor:pointer;border-bottom:1px solid transparent}
.tela-acessos :deep(.ac-org-head:hover){background:rgba(13,148,136,.05)}
.tela-acessos :deep(.ac-org-block.open .ac-org-head){border-bottom-color:var(--border)}
.tela-acessos :deep(.ac-org-badge){width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0f766e,#0d9488);color:#fff;flex-shrink:0}
.tela-acessos :deep(.ac-org-name){font-family:'Playfair Display',serif;font-weight:700;font-size:21px;color:var(--text);line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tela-acessos :deep(.ac-org-meta){font-family:'IBM Plex Sans',sans-serif;font-size:10.5px;font-weight:600;letter-spacing:.6px;color:var(--muted);margin-top:3px;text-transform:uppercase}
.tela-acessos :deep(.ac-org-chev){color:var(--muted);transition:transform .2s ease;flex-shrink:0}
.tela-acessos :deep(.ac-org-block.open .ac-org-chev){transform:rotate(90deg)}
.tela-acessos :deep(.ac-org-body){display:none;padding:16px 18px;gap:14px;grid-template-columns:repeat(auto-fill,minmax(240px,1fr))}
.tela-acessos :deep(.ac-org-block.open .ac-org-body){display:grid}
.tela-acessos :deep(.ac-stcard){border:1px solid var(--border);border-radius:14px;padding:14px;background:var(--surface2);cursor:pointer;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease}
.tela-acessos :deep(.ac-stcard:hover){transform:translateY(-2px);border-color:var(--accent-mid);box-shadow:var(--shadow-md)}
.tela-acessos :deep(.ac-stcard-h){display:flex;align-items:center;justify-content:space-between;gap:8px}
.tela-acessos :deep(.ac-stcard-name){font-family:'Oswald',sans-serif;font-weight:600;font-size:15px;letter-spacing:.4px;text-transform:uppercase;color:var(--text)}
.tela-acessos :deep(.ac-stcard-ct){font-family:'Oswald',sans-serif;font-size:12px;font-weight:500;color:#2dd4bf;background:rgba(13,148,136,.16);padding:2px 9px;border-radius:999px;white-space:nowrap}
.tela-acessos :deep(.ac-ava-stack){display:flex;align-items:center;margin-top:12px;flex-wrap:wrap;row-gap:6px}
.tela-acessos :deep(.ac-ava-stack .ac-avatar){box-shadow:0 0 0 2px var(--surface2);margin-left:-8px}
.tela-acessos :deep(.ac-ava-stack .ac-avatar:first-child){margin-left:0}
.tela-acessos :deep(.ac-ava-more){font-family:'IBM Plex Sans',sans-serif;font-size:11px;font-weight:700;color:var(--muted);margin-left:8px}
.tela-acessos :deep(.ac-empty){font-family:'IBM Plex Sans',sans-serif;color:var(--muted);font-size:13px;padding:8px 2px}
@media(max-width:640px){
.tela-acessos :deep(.ac-body){padding:16px 14px}
.tela-acessos :deep(.ac-hero-actions){margin-left:0;width:100%}
.tela-acessos :deep(.ac-hero-actions .ac-btn){flex:1;min-width:140px;text-align:center}
.tela-acessos :deep(.ac-btn){padding:11px 14px;font-size:14px}
.tela-acessos :deep(.ac-org-body){grid-template-columns:1fr}
.tela-acessos :deep(.ac-org-name){font-size:18px;white-space:normal}
.tela-acessos :deep(.ac-tabs){width:100%;margin-left:0;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:2px}
.tela-acessos :deep(.ac-tab){white-space:nowrap;flex-shrink:0}
.tela-acessos :deep(.ac-modal){max-height:88vh;overflow:auto}
.tela-acessos :deep(.ac-section-h){flex-wrap:wrap}
}
/* ===== Acessos — Fase 1: ficha do colaborador ===== */
.tela-acessos :deep(.ac-ficha-hero){display:flex;align-items:center;gap:18px;flex-wrap:wrap}
.tela-acessos :deep(.ac-ficha-hero .ac-avatar){box-shadow:0 10px 26px -12px rgba(0,0,0,.55),0 0 0 3px var(--surface)}
.tela-acessos :deep(.ac-ficha-id){min-width:0;flex:1}
.tela-acessos :deep(.ac-ficha-name){font-family:'Playfair Display',serif;font-weight:800;font-size:clamp(22px,3.4vw,30px);line-height:1.05;letter-spacing:-.01em;color:var(--text);display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.tela-acessos :deep(.ac-ficha-sub){font-family:'IBM Plex Sans',sans-serif;font-size:13px;color:var(--muted);margin-top:7px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.tela-acessos :deep(.ac-ficha-sub .dot){opacity:.4}
.tela-acessos :deep(.ac-ficha-actions){display:flex;gap:8px;flex-wrap:wrap;margin-top:18px;padding-top:16px;border-top:1px solid var(--border)}
.tela-acessos :deep(.ac-fgrid){display:grid;grid-template-columns:repeat(auto-fit,minmax(258px,1fr));gap:14px;margin-top:18px}
.tela-acessos :deep(.ac-fblock){background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:6px 16px 10px}
.tela-acessos :deep(.ac-fblock-h){font-family:'Oswald',sans-serif;font-weight:600;font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:var(--muted);margin:12px 0 4px}
.tela-acessos :deep(.ac-field){display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)}
.tela-acessos :deep(.ac-field:last-child){border-bottom:none}
.tela-acessos :deep(.ac-field-l){font-family:'IBM Plex Sans',sans-serif;font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px;min-width:0;white-space:nowrap}
.tela-acessos :deep(.ac-field-v){font-family:'IBM Plex Sans',sans-serif;font-size:13.5px;color:var(--text);margin-left:auto;text-align:right;word-break:break-word;font-weight:600}
.tela-acessos :deep(.ac-field-v.empty){color:var(--muted);font-weight:400}
@media(max-width:640px){
.tela-acessos :deep(.ac-ficha-actions){width:100%}
.tela-acessos :deep(.ac-ficha-actions .ac-btn){flex:1 1 calc(50% - 4px);min-width:0;text-align:center}
.tela-acessos :deep(.ac-fgrid){grid-template-columns:1fr}
}
/* ===== Acessos — Fase 1: auditoria ===== */
.tela-acessos :deep(.ac-audcard){padding:16px 18px;display:flex;flex-direction:column}
.tela-acessos :deep(.ac-aud-hd){display:flex;align-items:center;gap:12px;padding-bottom:12px;border-bottom:1px solid var(--border);margin-bottom:2px}
.tela-acessos :deep(.ac-aud-item){padding:9px 0;border-bottom:1px solid var(--border);display:grid;grid-template-columns:104px 1fr;gap:12px;align-items:baseline}
.tela-acessos :deep(.ac-aud-item:last-child){border-bottom:none}
.tela-acessos :deep(.ac-aud-k){font-family:'IBM Plex Sans',sans-serif;font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:var(--muted);display:flex;align-items:center;gap:5px}
.tela-acessos :deep(.ac-aud-v){font-family:'IBM Plex Sans',sans-serif;font-size:13px;color:var(--text);word-break:break-word;line-height:1.45}
.tela-acessos :deep(.ac-audrow){display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:12px 14px;background:var(--surface);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow-sm);margin-bottom:8px;transition:border-color .15s,box-shadow .15s}
.tela-acessos :deep(.ac-audrow:hover){border-color:rgba(13,148,136,.45);box-shadow:var(--shadow-md)}
.tela-acessos :deep(.ac-audrow .grow){flex:1;min-width:140px}
.tela-acessos :deep(.ac-audrow-counts){display:flex;gap:6px;flex-wrap:wrap;margin-left:auto}
.tela-acessos :deep(.ac-cnt){display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:8px;background:var(--surface2);border:1px solid var(--border);font-family:'IBM Plex Sans',sans-serif;font-size:11px;font-weight:600;color:var(--text);white-space:nowrap}
.tela-acessos :deep(.ac-cnt.zero){color:var(--muted);opacity:.65}
.tela-acessos :deep(.ac-aud-setor){font-family:'Oswald',sans-serif;font-weight:600;font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:var(--text);margin:18px 0 10px;display:flex;align-items:center;gap:8px}
.tela-acessos :deep(.ac-aud-setor::after){content:"";flex:1;height:1px;background:var(--border)}
@media(max-width:640px){
.tela-acessos :deep(.ac-audrow-counts){width:100%;margin-left:0;order:3}
.tela-acessos :deep(.ac-audrow>.ac-btn){width:100%;order:4}
.tela-acessos :deep(.ac-aud-item){grid-template-columns:1fr;gap:3px}
}
/* ===== Acessos — anti-zoom no mobile (iOS dá zoom ao focar campo <16px) ===== */
.tela-acessos{touch-action:manipulation}
@media(max-width:640px){
.tela-acessos :deep(.ac-input), .tela-acessos :deep(.ac-select), .tela-acessos :deep(.ac-textarea){font-size:16px}
.tela-acessos :deep(.ac-modal .ac-input), .tela-acessos :deep(.ac-modal .ac-select), .tela-acessos :deep(.ac-modal .ac-textarea){font-size:16px}
}
/* ===== Acessos — Fase 2: Drive ===== */
.tela-acessos :deep(.ac-brand-bar){display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px}
.tela-acessos :deep(.ac-brand-chip){position:relative;display:inline-flex;align-items:center;gap:8px;padding:9px 14px;border-radius:12px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-family:'Oswald',sans-serif;font-weight:600;font-size:13px;letter-spacing:.5px;text-transform:uppercase;cursor:pointer;transition:border-color .15s,box-shadow .15s,background .15s}
.tela-acessos :deep(.ac-brand-chip:hover){border-color:var(--accent-mid)}
.tela-acessos :deep(.ac-brand-chip.active){background:linear-gradient(135deg,#0f766e,#0d9488);border-color:#0d9488;color:#fff;box-shadow:0 6px 16px -8px rgba(13,148,136,.7)}
.tela-acessos :deep(.ac-brand-x){opacity:.55;font-size:11px;line-height:1}
.tela-acessos :deep(.ac-brand-x:hover){opacity:1}
.tela-acessos :deep(.ac-crumb){display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:16px;font-family:'IBM Plex Sans',sans-serif;font-size:13px;color:var(--muted)}
.tela-acessos :deep(.ac-crumb-b){background:none;border:none;color:var(--accent-mid);cursor:pointer;font:inherit;padding:2px 4px;border-radius:6px}
.tela-acessos :deep(.ac-crumb-b:hover){background:rgba(13,148,136,.1)}
.tela-acessos :deep(.ac-secmod){margin-bottom:26px}
.tela-acessos :deep(.ac-secmod-h){font-family:'Oswald',sans-serif;font-weight:600;font-size:13px;letter-spacing:1.4px;text-transform:uppercase;color:var(--text);margin:0 0 12px;display:flex;align-items:center;gap:10px;padding-bottom:8px;border-bottom:1px solid var(--border)}
.tela-acessos :deep(.ac-move){width:auto;max-width:138px;padding:6px 8px;font-size:11px}
.tela-acessos :deep(.ac-folder[draggable=true]){cursor:grab;-webkit-user-select:none;user-select:none}
.tela-acessos :deep(.ac-folder[draggable=true]:active){cursor:grabbing}
.tela-acessos :deep(.ac-folder.ac-dragging){opacity:.45;border-style:dashed}
.tela-acessos :deep(.ac-secbody){min-height:10px}
.tela-acessos :deep(.ac-move), .tela-acessos :deep(.ac-folder .ac-btn){cursor:pointer}
.tela-acessos :deep(.ac-secmod.ac-drop-on){outline:2px dashed #0d9488;outline-offset:4px;border-radius:14px;background:rgba(13,148,136,.04)}
.tela-acessos :deep(.ac-driveviews){display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap}
/* Árvore do WorkDrive: ocupa toda a largura disponível e, se o ramo for muito
   fundo pro celular, quem rola de lado é esta caixa — nunca a página. */
.tela-acessos :deep(.ac-wd-arvore){width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}
/* No celular o card da pasta deixa de ter teto de largura: aproveita a tela toda
   em vez de sobrar faixa vazia à direita. */
@media(max-width:640px){.tela-acessos :deep(.ac-wd-arvore .ac-vcard){max-width:none}}
.tela-acessos :deep(.ac-drive-marcabar){display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 16px;border:1px solid var(--border);border-radius:12px;background:var(--surface2);margin-bottom:14px}
.tela-acessos :deep(.ac-drive-marcabar .grow){flex:1;min-width:160px}
.tela-acessos :deep(.ac-drive-marca-nome){font-family:'Playfair Display',serif;font-weight:700;font-size:17px;color:var(--text)}
@media(max-width:640px){.tela-acessos :deep(.ac-drive-marcabar .ac-btn){width:100%}}
.tela-acessos :deep(.ac-tree){list-style:none;margin:0;padding-left:20px}
.tela-acessos :deep(.ac-tnode){position:relative;padding-left:20px}
.tela-acessos :deep(.ac-tnode::before){content:"";position:absolute;left:0;top:0;width:14px;height:20px;border-left:1px solid var(--border);border-bottom:1px solid var(--border);border-bottom-left-radius:7px}
.tela-acessos :deep(.ac-tnode::after){content:"";position:absolute;left:0;top:20px;bottom:0;border-left:1px solid var(--border)}
.tela-acessos :deep(.ac-tnode:last-child::after){display:none}
.tela-acessos :deep(.ac-tree-root){padding-left:2px}
.tela-acessos :deep(.ac-tree-root>.ac-tnode){padding-left:0}
.tela-acessos :deep(.ac-tree-root>.ac-tnode::before), .tela-acessos :deep(.ac-tree-root>.ac-tnode::after){display:none}
.tela-acessos :deep(.ac-tn-row){display:flex;align-items:center;gap:8px;padding:4px 0}
.tela-acessos :deep(.ac-tn-tog){width:20px;height:20px;border:1px solid var(--border);background:var(--surface);color:var(--muted);border-radius:6px;cursor:pointer;font-size:10px;flex-shrink:0;transition:transform .15s ease;line-height:1}
.tela-acessos :deep(.ac-tn-tog.open){transform:rotate(90deg)}
.tela-acessos :deep(.ac-tn-dot){width:20px;flex-shrink:0}
.tela-acessos :deep(.ac-tn-ico){font-size:15px;line-height:1}
.tela-acessos :deep(.ac-tn-name){font-family:'IBM Plex Sans',sans-serif;font-size:13px;font-weight:600;color:var(--text);word-break:break-word}
.tela-acessos :deep(.ac-tn-sec){font-family:'IBM Plex Sans',sans-serif;font-size:9.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#2dd4bf;background:rgba(13,148,136,.14);padding:2px 7px;border-radius:999px;white-space:nowrap}
.tela-acessos :deep(.ac-tn-share){padding:3px 9px;font-size:11px;margin-left:auto;flex-shrink:0}
@media(max-width:640px){.tela-acessos :deep(.ac-tn-sec){display:none}.tela-acessos :deep(.ac-tree){padding-left:14px}.tela-acessos :deep(.ac-tnode){padding-left:14px}}
/* ===== Drive: fluxograma (org-chart) ===== */
.tela-acessos :deep(.ac-legend){display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px}
.tela-acessos :deep(.ac-leg){display:inline-flex;align-items:center;gap:7px;font-family:'IBM Plex Sans',sans-serif;font-size:12px;color:var(--text);background:var(--surface);border:1px solid var(--border);border-radius:999px;padding:4px 6px 4px 11px}
.tela-acessos :deep(.ac-leg-dot){width:11px;height:11px;border-radius:50%;flex-shrink:0}
.tela-acessos :deep(.ac-leg-go){border:none;background:#0d9488;color:#fff;border-radius:999px;font-size:10px;font-weight:700;padding:4px 10px;cursor:pointer;text-transform:uppercase;letter-spacing:.4px}
.tela-acessos :deep(.ac-leg-go:hover){filter:brightness(1.08)}
.tela-acessos :deep(.ac-org-wrap){overflow:auto;padding:8px 4px 24px}
.tela-acessos :deep(.ac-org), .tela-acessos :deep(.ac-org ul){display:flex;justify-content:center;padding-top:22px;position:relative;margin:0;list-style:none}
.tela-acessos :deep(.ac-org li){position:relative;padding:22px 9px 0;display:flex;flex-direction:column;align-items:center}
.tela-acessos :deep(.ac-org li::before), .tela-acessos :deep(.ac-org li::after){content:'';position:absolute;top:0;right:50%;border-top:2px solid var(--border);width:50%;height:22px}
.tela-acessos :deep(.ac-org li::after){right:auto;left:50%;border-left:2px solid var(--border)}
.tela-acessos :deep(.ac-org li:only-child::before), .tela-acessos :deep(.ac-org li:only-child::after){display:none}
.tela-acessos :deep(.ac-org li:first-child::before), .tela-acessos :deep(.ac-org li:last-child::after){border:0 none}
.tela-acessos :deep(.ac-org li:last-child::before){border-right:2px solid var(--border);border-radius:0 9px 0 0}
.tela-acessos :deep(.ac-org li:first-child::after){border-radius:9px 0 0 0}
.tela-acessos :deep(.ac-org ul::before){content:'';position:absolute;top:0;left:50%;border-left:2px solid var(--border);width:0;height:22px}
.tela-acessos :deep(.ac-org>li){padding-top:0}
.tela-acessos :deep(.ac-org>li::before), .tela-acessos :deep(.ac-org>li::after){display:none}
.tela-acessos :deep(.ac-fcard){display:inline-flex;flex-direction:column;width:170px;background:var(--surface);border:1px solid var(--border);border-top:3px solid var(--sc,#0d9488);border-radius:11px;box-shadow:var(--shadow-sm);transition:transform .14s ease,box-shadow .14s ease}
.tela-acessos :deep(.ac-fcard:hover){transform:translateY(-2px);box-shadow:var(--shadow-md)}
.tela-acessos :deep(.ac-fcard-root){border-top:3px solid #0d9488;background:linear-gradient(180deg,rgba(13,148,136,.14),var(--surface));width:200px}
.tela-acessos :deep(.ac-fcard-body){padding:9px 11px}
.tela-acessos :deep(.ac-fcard-name){font-family:'IBM Plex Sans',sans-serif;font-size:12px;font-weight:600;color:var(--text);line-height:1.25;max-height:3.1em;overflow:hidden}
.tela-acessos :deep(.ac-fcard-root .ac-fcard-name){font-family:'Playfair Display',serif;font-size:15px;font-weight:700}
.tela-acessos :deep(.ac-fcard-sec){font-family:'IBM Plex Sans',sans-serif;font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;margin-top:4px;color:var(--muted)}
.tela-acessos :deep(.ac-fcard-acts){display:flex;gap:5px;margin-top:8px;justify-content:flex-end}
.tela-acessos :deep(.ac-fcard-share), .tela-acessos :deep(.ac-fcard-tog){border:1px solid var(--border);background:var(--surface2);border-radius:7px;cursor:pointer;font-size:12px;padding:3px 8px;color:var(--text);min-width:26px;line-height:1.1}
.tela-acessos :deep(.ac-fcard-share:hover), .tela-acessos :deep(.ac-fcard-tog:hover){border-color:var(--accent-mid);color:var(--accent-mid)}
.tela-acessos :deep(.ac-fcard-tog){font-weight:700}
/* ===== Drive: arvore vertical (cards coloridos, sem scroll lateral) ===== */
.tela-acessos :deep(.ac-vcard){display:inline-flex;align-items:center;gap:9px;max-width:560px;background:var(--surface);border:1px solid var(--border);border-left:4px solid var(--sc,#0d9488);border-radius:10px;padding:7px 11px;box-shadow:var(--shadow-sm);transition:box-shadow .14s ease,transform .14s ease}
.tela-acessos :deep(.ac-vcard:hover){box-shadow:var(--shadow-md);transform:translateX(2px)}
.tela-acessos :deep(.ac-vcard-root){border-left-color:#0d9488;background:linear-gradient(90deg,rgba(13,148,136,.16),var(--surface))}
.tela-acessos :deep(.ac-vc-ico){font-size:15px;line-height:1;flex-shrink:0}
.tela-acessos :deep(.ac-vc-name){font-family:'IBM Plex Sans',sans-serif;font-size:13px;font-weight:600;color:var(--text);min-width:0;overflow-wrap:anywhere;line-height:1.25}
.tela-acessos :deep(.ac-vcard-root .ac-vc-name){font-family:'Playfair Display',serif;font-size:16px;font-weight:700}
.tela-acessos :deep(.ac-vc-sec){font-family:'IBM Plex Sans',sans-serif;font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;white-space:nowrap;flex-shrink:0}
.tela-acessos :deep(.ac-vc-count){font-family:'Oswald',sans-serif;font-size:11px;font-weight:600;color:var(--muted);background:var(--surface2);border:1px solid var(--border);border-radius:999px;padding:1px 8px;flex-shrink:0}
.tela-acessos :deep(.ac-vc-share){border:1px solid var(--border);background:var(--surface2);border-radius:7px;cursor:pointer;font-size:12px;padding:3px 8px;color:var(--text);flex-shrink:0;line-height:1.1}
.tela-acessos :deep(.ac-vc-share:hover){border-color:var(--accent-mid);color:var(--accent-mid)}
@media(max-width:640px){.tela-acessos :deep(.ac-vc-sec){display:none}.tela-acessos :deep(.ac-vcard){gap:7px;padding:6px 9px}}
.tela-acessos :deep(.ac-folder-grid){display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
.tela-acessos :deep(.ac-folder){background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px;box-shadow:var(--shadow-sm);display:flex;flex-direction:column;gap:10px;transition:border-color .15s,box-shadow .15s,transform .15s}
.tela-acessos :deep(.ac-folder:hover){border-color:var(--accent-mid);box-shadow:var(--shadow-md);transform:translateY(-2px)}
.tela-acessos :deep(.ac-folder-top){display:flex;align-items:center;gap:10px}
.tela-acessos :deep(.ac-folder-ico){font-size:20px;line-height:1}
.tela-acessos :deep(.ac-folder-name){font-family:'IBM Plex Sans',sans-serif;font-weight:600;font-size:13.5px;color:var(--text);word-break:break-word;line-height:1.25}
.tela-acessos :deep(.ac-folder-sub){font-family:'IBM Plex Sans',sans-serif;font-size:11px;color:var(--muted);margin-top:2px}
.tela-acessos :deep(.ac-folder-actions){display:flex;gap:6px;flex-wrap:wrap;margin-top:auto}
.tela-acessos :deep(.ac-folder-actions .ac-btn){padding:6px 12px;font-size:12px}
.tela-acessos :deep(.ac-pick){display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:8px;cursor:pointer}
.tela-acessos :deep(.ac-pick:hover){background:rgba(13,148,136,.06)}
.tela-acessos :deep(.ac-pick .grow){font-family:'IBM Plex Sans',sans-serif;font-size:13px;min-width:0}
.tela-acessos :deep(.ac-pick-search){margin-bottom:8px}
.tela-acessos :deep(.ac-pick-list){max-height:42vh;overflow:auto;border:1px solid var(--border);border-radius:10px;background:var(--surface)}
.tela-acessos :deep(.ac-pick-grp-h){position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 10px;background:var(--surface2);border-bottom:1px solid var(--border);font-family:'Oswald',sans-serif;font-size:11px;font-weight:600;letter-spacing:.8px;text-transform:uppercase;color:var(--muted);z-index:1}
.tela-acessos :deep(.ac-pick-all){border:1px solid var(--border);background:var(--surface);color:var(--accent-mid);border-radius:6px;font-family:'IBM Plex Sans',sans-serif;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;padding:3px 9px;cursor:pointer}
.tela-acessos :deep(.ac-pick-all:hover){border-color:var(--accent-mid)}
.tela-acessos :deep(.ac-pick-list .ac-pick){border-radius:0;border-bottom:1px solid var(--border);padding:8px 10px}
.tela-acessos :deep(.ac-pick-grp:last-child .ac-pick:last-child){border-bottom:none}
.tela-acessos :deep(.ac-pick .grow){display:flex;flex-direction:column;min-width:0}
.tela-acessos :deep(.ac-pick-name){font-family:'IBM Plex Sans',sans-serif;font-size:13.5px;font-weight:600;color:var(--text);line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tela-acessos :deep(.ac-pick-meta){font-family:'IBM Plex Sans',sans-serif;font-size:11.5px;color:var(--muted);line-height:1.2;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* painel grande de compartilhar */
.tela-acessos :deep(.ac-modal-lg){max-width:720px;width:100%;max-height:90vh;display:flex;flex-direction:column;padding:0;overflow:hidden}
.tela-acessos :deep(.ac-modal-head){display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:18px 22px;border-bottom:1px solid var(--border)}
.tela-acessos :deep(.ac-modal-head h3){font-family:'Oswald',sans-serif;font-weight:600;letter-spacing:.5px;font-size:18px}
.tela-acessos :deep(.ac-modal-body){flex:1;min-height:0;overflow:auto;padding:18px 22px}
.tela-acessos :deep(.ac-modal-foot){display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:14px 22px;border-top:1px solid var(--border);background:var(--surface2)}
.tela-acessos :deep(.ac-pick-count){font-family:'IBM Plex Sans',sans-serif;font-size:12px;font-weight:600;color:var(--muted);white-space:nowrap}
.tela-acessos :deep(.ac-pick-count.on){color:var(--accent-mid)}
.tela-acessos :deep(.ac-modal-lg .ac-pick-list){max-height:none;border:1px solid var(--border)}
@media(max-width:640px){
.tela-acessos :deep(.ac-modal-lg){max-height:94vh}
.tela-acessos :deep(.ac-modal-head), .tela-acessos :deep(.ac-modal-body), .tela-acessos :deep(.ac-modal-foot){padding-left:14px;padding-right:14px}
.tela-acessos :deep(.ac-modal-foot .ac-btn.primary){flex:1}
}
.tela-acessos :deep(.ac-secmod-toggle){cursor:pointer;user-select:none}
.tela-acessos :deep(.ac-secchev){display:inline-block;transition:transform .18s ease;color:var(--muted);font-size:11px}
.tela-acessos :deep(.ac-secchev.open){transform:rotate(90deg)}
.tela-acessos :deep(.ac-depth){display:flex;align-items:center;gap:8px;margin-bottom:18px;flex-wrap:wrap;font-family:'IBM Plex Sans',sans-serif;font-size:12px;color:var(--muted)}
.tela-acessos :deep(.ac-depth-b){border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:8px;width:30px;height:30px;cursor:pointer;font-weight:600;font-family:'Oswald',sans-serif}
.tela-acessos :deep(.ac-depth-b.active){background:#0d9488;border-color:#0d9488;color:#fff}
.tela-acessos :deep(.ac-folder-sub){white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media(max-width:640px){.tela-acessos :deep(.ac-folder-grid){grid-template-columns:1fr}}
/* ===== Acessos — Fase 1: conexões ===== */
.tela-acessos :deep(.ac-conn-grid){display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}
.tela-acessos :deep(.ac-conn){background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px;box-shadow:var(--shadow-md);display:flex;flex-direction:column;gap:10px;transition:border-color .16s,box-shadow .16s}
.tela-acessos :deep(.ac-conn:hover){border-color:var(--accent-mid);box-shadow:var(--shadow-lg)}
.tela-acessos :deep(.ac-conn-top){display:flex;align-items:center;gap:10px}
.tela-acessos :deep(.ac-conn-name){font-family:'Oswald',sans-serif;font-weight:600;font-size:16px;letter-spacing:.5px;text-transform:uppercase;color:var(--text)}
.tela-acessos :deep(.ac-conn-desc){font-family:'IBM Plex Sans',sans-serif;font-size:12.5px;color:var(--muted);line-height:1.45;flex:1}
.tela-acessos :deep(.ac-conn-actions){display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}
@media(max-width:640px){.tela-acessos :deep(.ac-conn-actions .ac-btn){flex:1;min-width:120px;text-align:center}}
.tela-acessos :deep(.ac-muted){color:var(--muted);opacity:1}
.tela-acessos :deep(.ac-btn){background:#0d9488;color:#fff;box-shadow:var(--shadow-sm)}
.tela-acessos :deep(.ac-btn:hover){filter:brightness(1.06);box-shadow:var(--shadow-md)}
.tela-acessos :deep(.ac-btn.danger){background:var(--red);color:#fff}
.tela-acessos :deep(.ac-input), .tela-acessos :deep(.ac-select), .tela-acessos :deep(.ac-textarea){background:var(--surface);border:1px solid var(--border);color:var(--text)}
.tela-acessos :deep(.ac-input:focus), .tela-acessos :deep(.ac-select:focus), .tela-acessos :deep(.ac-textarea:focus){border-color:var(--accent-mid);outline:none;box-shadow:0 0 0 3px var(--accent-light)}
.tela-acessos :deep(.ac-pill.ok){background:rgba(13,148,136,.16);color:#0a7e72}
.tela-acessos :deep(.ac-pill.warn){background:rgba(234,179,8,.18);color:var(--yellow)}
.tela-acessos :deep(.ac-pill.bad){background:rgba(244,63,94,.16);color:var(--red)}
.tela-acessos :deep(.ac-pill.neutral){background:rgba(120,130,150,.18);color:var(--muted)}
.tela-acessos :deep(.ac-setores-grid .ac-setor-card){background:var(--surface);border:1px solid var(--border);box-shadow:var(--shadow-md)}
.tela-acessos :deep(.ac-setor-card:hover){border-color:rgba(13,148,136,.5);box-shadow:var(--shadow-lg)}
.tela-acessos :deep(.ac-setor-nome){color:var(--text)}
.tela-acessos :deep(.ac-setor-sub){color:var(--muted)}
.tela-acessos :deep(.ac-count){background:#0d9488;color:#fff}
.tela-acessos :deep(.ac-setor-del){background:var(--surface);border:1px solid var(--border);color:var(--red)}
.tela-acessos :deep(.ac-chip){background:var(--surface2);border:1px solid var(--border);color:var(--text)}
.tela-acessos :deep(.ac-section-h h3), .tela-acessos :deep(h2), .tela-acessos :deep(h3){color:var(--text)}
.tela-acessos :deep(.ac-modal){background:var(--surface);border:1px solid var(--border);color:var(--text);box-shadow:var(--shadow-lg)}
/* Copiar link (Compartilhar + Liberar setor) */
.tela-acessos :deep(.ac-linkbar){display:flex;align-items:center;gap:12px;padding:12px 14px;margin:0 0 16px;border:1px solid var(--accent-mid);background:var(--accent-light);border-radius:12px}
.tela-acessos :deep(.ac-linkurl){font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11.5px;color:var(--text);opacity:.85;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tela-acessos :deep(.ac-note){font-size:12.5px;line-height:1.55;color:var(--muted);background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:11px 13px;margin:0 0 14px}
.tela-acessos :deep(.ac-note-warn){color:var(--text);background:rgba(184,88,0,.12);border-color:var(--orange)}
.tela-acessos :deep(.ac-note-warn b){color:var(--text)}
/* Auditoria — OneDrive consolidado (drive completo / setor + detalhar) */
.tela-acessos :deep(.ac-od-chip){display:block;margin:0 0 5px;font-size:12.5px;line-height:1.5}
.tela-acessos :deep(.ac-od-chip:last-child){margin-bottom:0}
.tela-acessos :deep(.ac-detbtn){font-size:10.5px;border:1px solid var(--border);background:var(--surface2);color:var(--accent);border-radius:7px;padding:1px 7px;cursor:pointer;margin-left:4px;font-weight:700}
.tela-acessos :deep(.ac-detbtn:hover){background:var(--accent-light)}
.tela-acessos :deep(.ac-detlist){font-size:11.5px;color:var(--muted);margin:5px 0 2px;padding:7px 10px;border-left:2px solid var(--border);background:var(--surface2);border-radius:0 8px 8px 0;line-height:1.7}
.tela-acessos :deep(.ac-linklist){display:flex;flex-direction:column;gap:8px}
.tela-acessos :deep(.ac-linklist .ac-row){align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface2)}
.tela-acessos :deep(.ac-linklist .ac-row b){font-size:13px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
[data-theme="dark"] .tela-acessos :deep(.ac-pill.ok){color:#2dd4bf}
.tela-acessos :deep(.ac-avatar){border-radius:50%;object-fit:cover;flex:none;border:1px solid var(--border);background:var(--surface2)}
.tela-acessos :deep(.ac-avatar-fb){display:inline-flex;align-items:center;justify-content:center;font-weight:700;color:#fff;background:linear-gradient(135deg,#0f766e,#0d9488)}
.tela-acessos :deep(.ac-section-h){flex-wrap:wrap}
.tela-acessos :deep(.ac-row){flex-wrap:wrap}
.tela-acessos :deep(.ac-row .grow){min-width:0}
.tela-acessos :deep(.ac-avatar){flex:0 0 auto}
.tela-acessos :deep(.ac-navbar){display:flex;justify-content:center;gap:0;padding:14px 24px;border-bottom:1px solid var(--border)}
.tela-acessos :deep(.ac-navbar .ac-tabs){margin-left:0;gap:8px}
  /* ===== /Controle de Acessos ===== */
</style>
