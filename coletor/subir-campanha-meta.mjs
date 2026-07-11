#!/usr/bin/env node
// coletor/subir-campanha-meta.mjs — F3 Task 5: motor real de subida de campanhas
// WhatsApp (PAUSED) pra conta Vessel, a partir dos criativos multi-look da F3
// Task 7 (`gerar-criativos.mjs --looks produto-heroi,produto-sage-circulo`), via
// meta-proxy (Graph v22 — app agora está LIVE, fora de Development Mode).
//
// Estrutura por loja:
//   Campaign "[IA] <Loja> · WhatsApp · 11-07-2026"
//     └ AdSet "Geral (Promo)"  → 1 ad (o par promo)
//     └ AdSet "De x Por"       → 1 ad por (SKU × look)
//
// Mecanismo de imagem (apurado ao vivo nesta task, ver F3 Task 5 report):
//   1ª tentativa: POST /adimages {url} → devolveria um hash pra montar UM ad com
//   os DOIS formatos (Story 1080x1920 + Post 1080x1350) via asset_feed_spec +
//   asset_customization_rules (placement-aware) — é o que criarCreative() tenta
//   primeiro. HOJE esse endpoint ainda devolve "(#3) Application does not have
//   the capability to make this API call" mesmo com o app Live e ads_management
//   concedida (confirmado: campanha/adset criam normal — só /adimages via url
//   está bloqueado; bytes/base64 também não serve, o meta-proxy manda todo
//   parâmetro via query string e a imagem base64 estoura o limite de URL).
//   Fallback (o que roda de fato hoje): object_story_spec.link_data.picture=
//   <Story url> + link=https://wa.me/<numero da loja> + message curta + CTA
//   WHATSAPP_MESSAGE — UMA imagem só (a Story, formato vertical), sem o Post.
//   Consequência aceita por ora: o ad sobe só com o formato Story.
//
// Gotcha adicional (BM, não é bug de código): instagram_actor_id (IG @vessel.
// brasil, conectado à Página e à conta de anúncios — confirmado via GET
// /act/instagram_accounts) é rejeitado pelo Graph com "(#100) Param
// instagram_actor_id must be a valid Instagram account id" pro token do
// system user "coletor". GET /{business}/instagram_accounts confirma a causa:
// "(#10) ... requires that you can VIEW_INSTAGRAM_ACCOUNTS for this business
// account" — o system user não tem essa conta IG atribuída como asset no
// Business Manager (só a Página/conta de anúncios). criarCreative() tenta
// SEMPRE com instagram_actor_id primeiro e, se cair nesse erro específico,
// refaz sem — log de aviso claro. Efeito enquanto não for corrigido no BM: o
// ad roda só em posicionamentos do Facebook, não do Instagram.
//
// Uso:
//   node subir-campanha-meta.mjs --dry [--tivoli <campanhaId>] [--dompedro <campanhaId>]
//                                            # plano completo (2 campanhas/4 adsets/~ads), SEM chamar o Graph
//   node subir-campanha-meta.mjs --single [--tivoli <campanhaId>]
//                                            # TESTE REAL controlado: 1 campanha (Tivoli, PAUSED) + 1 adset
//                                            # (De x Por) + 1 ad (1º produto). É o único modo
//                                            # real habilitado nesta task — ver F3 Task 5 report antes de rodar
//                                            # o modo completo abaixo.
//   node subir-campanha-meta.mjs [--tivoli <id> --dompedro <id>]
//                                            # subida REAL completa (2 lojas, ~ads) — NÃO rodar sem revisão
//                                            # do resultado do --single pelo controlador.
// --tivoli/--dompedro sobrescrevem o campanhaId (fabrica_campanhas) de origem dos
// criativos por loja — default são os CFG.LOJAS abaixo (lote "estrela" antigo);
// pro teste desta task, aponta pro lote isnet: b5a4bdd0-a56f-48c3-a07c-09cf822c1de5.
import './lib/carregar-env.mjs';
import tls from 'node:tls';
import { loginServico } from './lib/bling-comercial.mjs';

// Fix de ambiente (achado nesta task, não documentado antes): o handshake TLS1.3
// default do `fetch`/`https` do Node é resetado (ECONNRESET, 100% determinístico,
// não é intermitente) por trás do Cloudflare que serve *.supabase.co, nesta máquina —
// `curl` e `python3` funcionam normalmente contra o mesmo host. Forçar TLS1.2
// programaticamente (equivalente a `node --tls-max-v1.2`, mas sem depender de flag
// de CLI) resolve 100% das tentativas nos testes feitos. Precisa rodar ANTES de
// qualquer fetch/https (inclusive dentro de loginServico()), por isso fica logo
// depois dos imports.
tls.DEFAULT_MAX_VERSION = 'TLSv1.2';

const DRY = process.argv.includes('--dry');
const SINGLE = process.argv.includes('--single');

function argVal(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : undefined;
}
const CLI_TIVOLI = argVal('--tivoli');
const CLI_DOMPEDRO = argVal('--dompedro');

const URL = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
// Fallback = anon key pública do projeto (mesmo default hardcoded em lib/bling-comercial.mjs).
// SUPABASE_ANON_KEY não está no .env local — sem este fallback, `apikey` ia undefined
// e toda chamada real ao meta-proxy (e a qualquer function) falhava com 401 "no apikey".
const ANON = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvdW5xdGRvaW9vb3R4cWVna2lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMDMwMDUsImV4cCI6MjA5NDc3OTAwNX0.MVXa6jngjKXkH3eZ7as_j_k8Eb7lJKcFmO4kCKAnuHM';
const SK = process.env.SUPABASE_SERVICE_KEY;
const REST = URL + '/rest/v1';
const H = { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' };

// --- CFG: valores REAIS (conta Vessel, app agora Live) ---------------------------------
const CFG = {
  ACCOUNT_ID: 'b6883e82-07cb-4f21-9fd7-ea7626786174', // accountId do meta-proxy
  ACT: 'act_1197997517858139',
  PAGE: '324679337390168',
  IG: '17841462952561833',
  DAILY_BUDGET: 5000, // centavos = R$50/dia por conjunto (ABO)
  DATA_CAMPANHA: '11-07-2026',
};

// Lojas: campanhaId = F3 Task 7 (gerar-criativos.mjs --looks produto-heroi,produto-sage-circulo
// --modos avista), que contém os criativos `produto` (2 looks × à-vista × 2 formatos por SKU)
// E `promo` (Geral, 1 par dual-formato) daquela loja. canalLojaId usado só pra enriquecer o
// nome do produto via gc_vendas_item (não vai pro Graph).
const LOJAS = [
  {
    nome: 'Tivoli',
    campanhaId: 'f558a275-3fc9-4367-8778-a67d3a5bbf84',
    whatsapp: '+5519971690502',
    geoCities: [267873, 241913], // Santa Bárbara d'Oeste, Americana
    canalLojaId: '205834140',
  },
  {
    nome: 'Dom Pedro',
    campanhaId: '7244508a-3e36-4855-bb39-c100af842960',
    whatsapp: '+5519999545112',
    geoCities: [247071], // Campinas
    canalLojaId: '205657609',
  },
];
if (CLI_TIVOLI) LOJAS[0].campanhaId = CLI_TIVOLI;
if (CLI_DOMPEDRO) LOJAS[1].campanhaId = CLI_DOMPEDRO;

let TOKEN;

// --- meta(): chamada ao Graph via meta-proxy, com retry em erro de rede E em 429/5xx -----
// (até 4 tentativas, backoff exponencial 1s/2s/4s). --dry nunca toca o Graph: só imprime
// o payload e devolve uma resposta fake pro fluxo seguir até o fim.
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
let fakeSeq = 0;
async function meta(path, params = {}, method = 'GET') {
  if (DRY) {
    console.log(`\n[dry] ${method} ${path}`);
    console.log(JSON.stringify(params, null, 2));
    fakeSeq++;
    if (method === 'POST' && /\/adimages$/.test(path)) {
      return { status: 200, d: { images: { [`fake-${fakeSeq}.png`]: { hash: `fake_hash_${fakeSeq}` } } } };
    }
    if (method === 'POST') return { status: 200, d: { id: `fake_id_${fakeSeq}` } };
    return { status: 200, d: {} };
  }
  const MAX_TENTATIVAS = 4;
  let ultimoErro;
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    try {
      const r = await fetch(URL + '/functions/v1/meta-proxy', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + TOKEN, apikey: ANON, 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: CFG.ACCOUNT_ID, path, params, method }),
      });
      const d = await r.json();
      if ((r.status === 429 || r.status >= 500) && tentativa < MAX_TENTATIVAS) {
        const espera = 1000 * 2 ** (tentativa - 1);
        console.warn(`  [retry] ${method} ${path} -> HTTP ${r.status}, tentativa ${tentativa}/${MAX_TENTATIVAS}, aguardando ${espera}ms`);
        await sleep(espera);
        continue;
      }
      return { status: r.status, d };
    } catch (e) {
      ultimoErro = e;
      if (tentativa < MAX_TENTATIVAS) {
        const espera = 1000 * 2 ** (tentativa - 1);
        console.warn(`  [retry] ${method} ${path} -> erro de rede (${e.message}), tentativa ${tentativa}/${MAX_TENTATIVAS}, aguardando ${espera}ms`);
        await sleep(espera);
        continue;
      }
    }
  }
  throw ultimoErro || new Error(`meta() falhou após ${MAX_TENTATIVAS} tentativas: ${method} ${path}`);
}

async function sbGet(p) {
  const r = await fetch(REST + p, { headers: H });
  if (!r.ok) throw new Error('GET ' + p + ' ' + r.status);
  return r.json();
}
async function sbPost(p, body, prefer) {
  const r = await fetch(REST + p, { method: 'POST', headers: prefer ? { ...H, Prefer: prefer } : H, body: JSON.stringify(body) });
  if (!r.ok && ![200, 201, 204].includes(r.status)) throw new Error('POST ' + p + ' ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r;
}

const brl = (n) => 'R$ ' + Number(n).toFixed(2).replace('.', ',');
const lookLabel = (variante) => (/sage/.test(variante) ? 'Sage' : 'Herói');

// storage_path: <campanha>/produto/<sku-saneado>-<variante>-<formato>.png
// (variante já inclui o look, ex.: produto-heroi-avista, produto-sage-circulo-avista —
// ver F3 Task 7). Extrai o sku saneado tirando o sufixo conhecido -variante-formato.png.
function skuDe(storagePath, variante, formato) {
  const file = (storagePath || '').split('/').pop() || '';
  const sufixo = `-${variante}-${formato}.png`;
  return file.endsWith(sufixo) ? file.slice(0, -sufixo.length) : file.replace(/\.png$/, '');
}

// Nome real do produto via gc_vendas_item (o sku no storage é saneado — espaços viram
// "_" — então tenta exato, depois com "_"→" "; se não achar nada, cai num rótulo
// legível a partir do próprio sku saneado).
const nomeCache = new Map();
async function nomeProduto(skuSane) {
  if (nomeCache.has(skuSane)) return nomeCache.get(skuSane);
  let rows = await sbGet(`/gc_vendas_item?select=produto&sku=eq.${encodeURIComponent(skuSane)}&limit=1`);
  if (!rows.length) {
    const comEspacos = skuSane.replace(/_/g, ' ');
    if (comEspacos !== skuSane) rows = await sbGet(`/gc_vendas_item?select=produto&sku=eq.${encodeURIComponent(comEspacos)}&limit=1`);
  }
  const nome = rows[0]?.produto || skuSane.replace(/[_-]/g, ' ');
  nomeCache.set(skuSane, nome);
  return nome;
}

// Agrupa os criativos `produto` da campanha por (sku, variante) — cada grupo é um par
// Story+Post (dual-formato) = 1 ad. Só devolve grupos completos (os dois formatos
// presentes); um grupo incompleto (upload/insert parcial) é logado e pulado, nunca sobe
// pela metade.
async function buscarProduto(loja) {
  const rows = await sbGet(`/fabrica_criativos?select=*&campanha_id=eq.${loja.campanhaId}&arquetipo=eq.produto&order=storage_path`);
  const grupos = new Map();
  for (const r of rows) {
    const sku = skuDe(r.storage_path, r.variante, r.formato);
    const key = sku + '|' + r.variante;
    if (!grupos.has(key)) grupos.set(key, { sku, variante: r.variante, precoDe: r.preco_de, precoPor: r.preco_por });
    const g = grupos.get(key);
    if (r.formato === '1080x1920') g.story = r;
    else if (r.formato === '1080x1350') g.post = r;
  }
  const completos = [];
  for (const g of grupos.values()) {
    if (g.story && g.post) completos.push(g);
    else console.warn(`  aviso: grupo incompleto (só 1 formato), pulado: ${g.sku} / ${g.variante}`);
  }
  return completos;
}

async function buscarPromo(loja) {
  const rows = await sbGet(`/fabrica_criativos?select=*&campanha_id=eq.${loja.campanhaId}&arquetipo=eq.promo&order=formato`);
  const story = rows.find((r) => r.formato === '1080x1920');
  const post = rows.find((r) => r.formato === '1080x1350');
  if (!story || !post) return null;
  return { sku: null, variante: 'number-hero', story, post };
}

function bodyProduto(loja, nome, precoDe, precoPor) {
  return `${nome} — de ${brl(precoDe)} por ${brl(precoPor)} na ${loja.nome}. Chama no WhatsApp e garante o seu!`;
}
function bodyPromo(loja) {
  return `Peças selecionadas com desconto na ${loja.nome}, parcelado em até 10x. Chama no WhatsApp e confira!`;
}
// Mensagem curta pro fallback single-picture (link_data.message) — nome do produto +
// % OFF calculado do De/Por real (cai pra genérico "OFERTA" se não der pra calcular).
function mensagemCurta(nome, precoDe, precoPor) {
  const de = Number(precoDe), por = Number(precoPor);
  const pct = de > 0 && por > 0 ? Math.round((1 - por / de) * 100) : null;
  return `${nome} — ${pct != null ? pct + '% OFF' : 'OFERTA'} · fale no WhatsApp`;
}
const waLink = (loja) => 'https://wa.me/' + String(loja.whatsapp).replace(/\D/g, '');

// --- upload de imagem (URL do Storage → image_hash) --------------------------------------
async function uploadImagem(url) {
  const r = await meta(`/${CFG.ACT}/adimages`, { url }, 'POST');
  if (r.status !== 200 || !r.d?.images) {
    throw new Error(`POST /adimages falhou (status ${r.status}): ${JSON.stringify(r.d).slice(0, 500)}`);
  }
  const hash = Object.values(r.d.images)[0]?.hash;
  if (!hash) throw new Error(`POST /adimages sem hash na resposta: ${JSON.stringify(r.d).slice(0, 500)}`);
  return hash;
}

// --- POST /adcreatives com fallback automático de instagram_actor_id -----------------------
// Gotcha do BM (não é bug de código, ver cabeçalho do arquivo): o token do system user
// "coletor" não tem a conta IG @vessel.brasil atribuída como asset (só Página + conta de
// anúncios) — toda tentativa com instagram_actor_id volta "(#100) Param instagram_actor_id
// must be a valid Instagram account id". Tenta sempre COM IG primeiro (assim, no dia em que o
// BM for corrigido, passa a funcionar sem precisar tocar no código); se cair nesse erro
// específico, refaz sem IG (ad roda só em posicionamentos do Facebook) e avisa no log.
async function criarAdCreative(params) {
  let r = await meta(`/${CFG.ACT}/adcreatives`, params, 'POST');
  if (r.status !== 200 && /instagram_actor_id must be a valid Instagram account id/.test(JSON.stringify(r.d))) {
    console.warn('  aviso: instagram_actor_id rejeitado (system user sem esse asset no Business Manager) — refazendo SEM Instagram (ad roda só no Facebook)');
    const semIG = JSON.parse(JSON.stringify(params));
    if (semIG.object_story_spec) delete semIG.object_story_spec.instagram_actor_id;
    r = await meta(`/${CFG.ACT}/adcreatives`, semIG, 'POST');
    params = semIG;
  }
  if (r.status !== 200 || !r.d?.id) {
    throw new Error(`POST /adcreatives falhou (status ${r.status}): ${JSON.stringify(r.d).slice(0, 800)}\npayload enviado: ${JSON.stringify(params).slice(0, 800)}`);
  }
  return { creativeId: r.d.id, payload: params };
}

// --- creative: tenta dual-formato via adimages (Story+Post num único ad, placement-aware);
// se /adimages falhar (hoje falha sempre — "(#3) Application does not have the capability to
// make this API call", mesmo com app Live e ads_management concedida; bytes/base64 também não
// serve porque o meta-proxy manda tudo via query string e a imagem estoura o limite de URL),
// cai pro fallback: object_story_spec.link_data.picture=<Story url> (uma imagem só, a Story)
// + link=wa.me da loja + message curta + CTA WHATSAPP_MESSAGE. Ver cabeçalho do arquivo.
async function criarCreative(loja, { storyUrl, postUrl, bodyText, titleText, mensagem }) {
  try {
    const storyHash = await uploadImagem(storyUrl);
    const postHash = await uploadImagem(postUrl);
    const params = {
      object_story_spec: { page_id: CFG.PAGE, instagram_actor_id: CFG.IG },
      asset_feed_spec: {
        images: [
          { hash: postHash, adlabels: [{ name: 'post' }] },
          { hash: storyHash, adlabels: [{ name: 'story' }] },
        ],
        bodies: [{ text: bodyText }],
        titles: [{ text: titleText }],
        call_to_action_types: ['WHATSAPP_MESSAGE'],
        asset_customization_rules: [
          {
            customization_spec: { facebook_positions: ['story', 'facebook_reels_overlay'], instagram_positions: ['story', 'reels'] },
            image_label: { name: 'story' }, title_label: { name: 'story' }, body_label: { name: 'story' },
          },
          {
            customization_spec: {
              facebook_positions: ['feed', 'video_feeds', 'marketplace', 'search', 'right_hand_column', 'instant_article'],
              instagram_positions: ['stream', 'explore', 'explore_home', 'profile_feed'],
            },
            image_label: { name: 'post' }, title_label: { name: 'post' }, body_label: { name: 'post' },
            is_default: true,
          },
        ],
      },
    };
    const { creativeId, payload } = await criarAdCreative(params);
    return { creativeId, mecanismo: 'adimages + asset_feed_spec (dual-formato: Story+Post)', storyHash, postHash, payload };
  } catch (e) {
    console.warn(`  aviso: dual-formato via /adimages falhou (${e.message.split('\n')[0]}) — usando fallback link_data.picture (Story, formato único)`);
  }

  const params = {
    object_story_spec: {
      page_id: CFG.PAGE,
      instagram_actor_id: CFG.IG,
      link_data: {
        picture: storyUrl,
        link: waLink(loja),
        name: titleText,
        message: mensagem,
        call_to_action: { type: 'WHATSAPP_MESSAGE' },
      },
    },
  };
  const { creativeId, payload } = await criarAdCreative(params);
  return { creativeId, mecanismo: 'link_data.picture (fallback — só Story, sem Post; /adimages indisponível)', payload };
}

async function criarAd({ adsetId, name, creativeId }) {
  const ad = await meta(`/${CFG.ACT}/ads`, {
    name,
    adset_id: adsetId,
    creative: { creative_id: creativeId },
    status: 'PAUSED',
  }, 'POST');
  if (ad.status !== 200 || !ad.d?.id) {
    throw new Error(`POST /ads falhou (status ${ad.status}): ${JSON.stringify(ad.d).slice(0, 500)}`);
  }
  return ad.d.id;
}

async function criarCampanha(loja) {
  const campaign = await meta(`/${CFG.ACT}/campaigns`, {
    name: `[IA] ${loja.nome} · WhatsApp · ${CFG.DATA_CAMPANHA}`,
    objective: 'OUTCOME_ENGAGEMENT',
    status: 'PAUSED',
    special_ad_categories: [],
    is_adset_budget_sharing_enabled: false,
  }, 'POST');
  if (campaign.status !== 200 || !campaign.d?.id) {
    throw new Error(`POST /campaigns falhou (status ${campaign.status}): ${JSON.stringify(campaign.d).slice(0, 500)}`);
  }
  return campaign.d.id;
}

async function criarAdSet(loja, campaignId, nomeConjunto) {
  const adset = await meta(`/${CFG.ACT}/adsets`, {
    name: nomeConjunto,
    campaign_id: campaignId,
    daily_budget: CFG.DAILY_BUDGET,
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'CONVERSATIONS',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP', // conta exige estratégia de lance explícita (achado nesta task)
    destination_type: 'WHATSAPP',
    promoted_object: { page_id: CFG.PAGE, whatsapp_phone_number: loja.whatsapp },
    targeting: { geo_locations: { cities: loja.geoCities.map((key) => ({ key })) } },
    status: 'PAUSED',
  }, 'POST');
  if (adset.status !== 200 || !adset.d?.id) {
    throw new Error(`POST /adsets falhou (status ${adset.status}): ${JSON.stringify(adset.d).slice(0, 500)}`);
  }
  return adset.d.id;
}

// --- subida completa (produção — não invocada nesta task, ver report) --------------------
async function subirConjuntoProduto(loja, campaignId) {
  const grupos = await buscarProduto(loja);
  const adsetId = await criarAdSet(loja, campaignId, 'De x Por');
  const adIds = [];
  for (const g of grupos) {
    const nome = await nomeProduto(g.sku);
    const { creativeId } = await criarCreative(loja, {
      storyUrl: g.story.url,
      postUrl: g.post.url,
      bodyText: bodyProduto(loja, nome, g.precoDe, g.precoPor),
      titleText: nome,
      mensagem: mensagemCurta(nome, g.precoDe, g.precoPor),
    });
    const adName = `${g.sku} · à vista · ${lookLabel(g.variante)}`;
    adIds.push(await criarAd({ adsetId, name: adName, creativeId }));
  }
  return { adsetId, adIds, count: grupos.length };
}

async function subirConjuntoPromo(loja, campaignId) {
  const grupo = await buscarPromo(loja);
  const adsetId = await criarAdSet(loja, campaignId, 'Geral (Promo)');
  const adIds = [];
  if (grupo) {
    const { creativeId } = await criarCreative(loja, {
      storyUrl: grupo.story.url,
      postUrl: grupo.post.url,
      bodyText: bodyPromo(loja),
      titleText: `Promoção ${loja.nome}`,
      mensagem: `Promoção ${loja.nome} — descontos selecionados · fale no WhatsApp`,
    });
    adIds.push(await criarAd({ adsetId, name: `Geral (Promo) · ${loja.nome}`, creativeId }));
  } else {
    console.warn(`  aviso: sem par promo dual-formato pra ${loja.nome} — conjunto Geral (Promo) ficará sem ad`);
  }
  return { adsetId, adIds, count: adIds.length };
}

async function subirLoja(loja) {
  console.log(`\n========== ${loja.nome} ==========`);
  const campaignId = await criarCampanha(loja);
  const geral = await subirConjuntoPromo(loja, campaignId);
  const dePor = await subirConjuntoProduto(loja, campaignId);

  const job = {
    conta_id: null,
    ad_account_id: CFG.ACT,
    loja: loja.nome,
    tipo: 'whatsapp',
    meta_campaign_id: campaignId,
    adset_ids: [geral.adsetId, dePor.adsetId],
    ad_ids: [...geral.adIds, ...dePor.adIds],
    payload: { geoCities: loja.geoCities, whatsapp: loja.whatsapp, criativos: { promo: geral.count, produto: dePor.count } },
    status: 'criado',
  };
  if (!DRY) await sbPost('/fabrica_meta_jobs', [job], 'return=minimal');
  else console.log(`\n[dry] fabrica_meta_jobs (NÃO gravado em --dry):\n${JSON.stringify(job, null, 2)}`);

  return { loja: loja.nome, campaignId, adsetIds: job.adset_ids, adCount: job.ad_ids.length };
}

// --- --dry: plano completo, sem chamadas reais ao Graph -----------------------------------
async function rodarDry() {
  const resumo = [];
  for (const loja of LOJAS) resumo.push(await subirLoja(loja));
  console.log('\n========== resumo (--dry) ==========');
  for (const r of resumo) console.log(r);
  const totalAds = resumo.reduce((s, r) => s + r.adCount, 0);
  console.log(`\ncampanhas: ${resumo.length} | conjuntos: ${resumo.length * 2} | ads: ${totalAds}`);
  console.log('(--dry) nenhuma chamada real ao Graph. Todos os ids acima são fake.');
}

// --- --single: TESTE REAL controlado (F3 Task 5) -------------------------------------------
// 1 campanha (Tivoli, PAUSED) + 1 adset (De x Por) + 1 ad (1º produto da campanha). Não mexe
// em Dom Pedro nem no conjunto Geral (Promo). Depois de criar, verifica via GET que ficou
// tudo PAUSED e loga qual mecanismo de imagem/IG efetivamente vingou (ver criarCreative()).
async function rodarTesteSingle() {
  const loja = LOJAS[0]; // Tivoli
  console.log(`\n========== TESTE ÚNICO REAL — ${loja.nome} (campanhaId origem: ${loja.campanhaId}) ==========`);
  const grupos = await buscarProduto(loja);
  if (!grupos.length) throw new Error('sem grupos produto completos (Story+Post) pra Tivoli');
  const g = grupos[0];
  const nome = await nomeProduto(g.sku);
  console.log(`1º produto: sku=${g.sku} variante=${g.variante} look=${lookLabel(g.variante)} nome="${nome}" de=${g.precoDe} por=${g.precoPor}`);
  console.log(`story: ${g.story.url}\npost:  ${g.post.url}`);

  console.log('\n-- criando campanha --');
  const campaignId = await criarCampanha(loja);
  console.log('campaign_id:', campaignId);

  console.log('\n-- criando adset "De x Por" --');
  const adsetId = await criarAdSet(loja, campaignId, 'De x Por');
  console.log('adset_id:', adsetId);

  console.log('\n-- criando creative (tenta dual-formato via adimages, cai pro fallback se falhar) --');
  const { creativeId, mecanismo, storyHash, postHash, payload } = await criarCreative(loja, {
    storyUrl: g.story.url,
    postUrl: g.post.url,
    bodyText: bodyProduto(loja, nome, g.precoDe, g.precoPor),
    titleText: nome,
    mensagem: mensagemCurta(nome, g.precoDe, g.precoPor),
  });
  console.log('creative_id:', creativeId, '| mecanismo:', mecanismo);
  if (storyHash) console.log('storyHash:', storyHash, '| postHash:', postHash);
  console.log('payload da creative:', JSON.stringify(payload, null, 2));

  console.log('\n-- criando ad --');
  const adName = `${g.sku} · à vista · ${lookLabel(g.variante)}`;
  const adId = await criarAd({ adsetId, name: adName, creativeId });
  console.log('ad_id:', adId, '| nome:', adName);

  console.log('\n-- verificação --');
  const campVerif = await meta(`/${campaignId}`, { fields: 'name,status' }, 'GET');
  console.log('GET campanha:', JSON.stringify(campVerif.d));
  const adsVerif = await meta(`/${adsetId}/ads`, { fields: 'name,status,creative{id,object_story_spec,asset_feed_spec{images,asset_customization_rules}}' }, 'GET');
  console.log('GET ads do adset:', JSON.stringify(adsVerif.d, null, 2));

  console.log('\n-- registrando fabrica_meta_jobs (status: teste-single) --');
  const job = {
    conta_id: null,
    ad_account_id: CFG.ACT,
    loja: loja.nome,
    tipo: 'whatsapp',
    meta_campaign_id: campaignId,
    adset_ids: [adsetId],
    ad_ids: [adId],
    payload: { sku: g.sku, variante: g.variante, nome, mecanismo, storyHash, postHash },
    status: 'teste-single',
  };
  await sbPost('/fabrica_meta_jobs', [job], 'return=minimal');

  console.log('\n========== TESTE ÚNICO concluído ==========');
  console.log({ campaignId, adsetId, adId, creativeId, mecanismo });
  console.log('TUDO PAUSED. Revisar no Gerenciador de Anúncios antes de rodar a subida completa.');
}

async function main() {
  if (DRY) return rodarDry();

  TOKEN = await loginServico();

  if (SINGLE) return rodarTesteSingle();

  // Subida REAL completa (2 lojas, ~72 ads) — implementada pra uso futuro, mas NÃO deve
  // ser disparada sem revisão prévia do resultado do --single (ver F3 Task 5 report).
  const resumo = [];
  for (const loja of LOJAS) resumo.push(await subirLoja(loja));
  console.log('\n========== resumo ==========');
  for (const r of resumo) console.log(r);
  const totalAds = resumo.reduce((s, r) => s + r.adCount, 0);
  console.log(`\ncampanhas: ${resumo.length} | conjuntos: ${resumo.length * 2} | ads: ${totalAds}`);
  console.log('\nsubida concluída — TUDO PAUSED. Revisar no Gerenciador de Anúncios e ativar manualmente.');
}
main().catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
