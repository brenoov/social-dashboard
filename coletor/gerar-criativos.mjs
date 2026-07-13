#!/usr/bin/env node
// coletor/gerar-criativos.mjs
// F2a: gera criativos (produto De/Por + promo) da última rodada da F1 + campanha.
// Uso: node gerar-criativos.mjs --pct 50 --nome "50% OFF - Sales" [--parcelas 10] [--dry]
//
// Modo "estrela" (F3 task 3b): em vez de ler fabrica_candidatos (F1, tag
// vazia), monta a lista de produtos a partir dos dados REAIS do Gestor
// Comercial (curva ABC/BCG): top faturamento (gc_vendas_item) que TEM
// estoque no depósito da loja (gc_estoque_item). Preço vem do Bling.
// Uso: node gerar-criativos.mjs --pct 50 --nome "Tivoli Estrela" \
//        --estrela 205834140 --deposito 14888726315 [--limite 20] [--dry]
import './lib/carregar-env.mjs';
import { loginServico, blingProdutos } from './lib/bling-comercial.mjs';
import { fotoDataUrl, fotoEhStudio } from './lib/foto-produto.mjs';
import { renderPNG, fecharRender } from './lib/render-criativo.mjs';
import { TEMPLATES, DIM } from './templates-criativos/templates.mjs';
import { variacoesProduto, variacoesPromo } from './lib/criativo-modelo.mjs';
import { gerarCopysProduto, gerarCopyPromo } from './lib/copy-efeito.mjs';
import { carregarMarcasELojas } from './lib/config-lojas.mjs';
import { carregarObjetivos, mapaObjetivo, looksDoObjetivo } from './lib/objetivos.mjs';
import { objetivosDoTemplate } from './templates-criativos/templates.mjs';
import { looksAtivosOrdenados } from './lib/looks.mjs';

const URL = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
const SK = process.env.SUPABASE_SERVICE_KEY;
const REST = URL + '/rest/v1';
const H = { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' };
const BUCKET = 'fabrica-criativos';
const sane = (s) => String(s).replace(/[^a-zA-Z0-9._-]+/g, '_');

// SP-3: o loop de promo usa 'promo-number-hero' (hardcoded em variacoesPromo). Só gera promo
// quando o objetivo permite esse look (ou quando não há objetivo — CLI legado).
export function objetivoPermitePromo(objetivo) {
  if (!objetivo) return true;
  const objs = objetivosDoTemplate('promo-number-hero');
  return objs.length === 0 || objs.includes(objetivo);
}

async function sbGet(p) { const r = await fetch(REST + p, { headers: H }); if (!r.ok) throw new Error('GET ' + p + ' ' + r.status); return r.json(); }
async function sbPost(p, body, prefer) { const r = await fetch(REST + p, { method: 'POST', headers: prefer ? { ...H, Prefer: prefer } : H, body: JSON.stringify(body) }); if (!r.ok && ![200,201,204].includes(r.status)) throw new Error('POST ' + p + ' ' + r.status + ' ' + (await r.text()).slice(0,200)); return r; }

async function garantirBucket() {
  await fetch(URL + '/storage/v1/bucket', { method: 'POST', headers: { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }) }).catch(() => {});
}
async function subir(path, buf) {
  const r = await fetch(`${URL}/storage/v1/object/${BUCKET}/${path}`, { method: 'POST', headers: { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'image/png', 'x-upsert': 'true' }, body: buf });
  if (!r.ok) throw new Error('upload ' + path + ' ' + r.status + ' ' + (await r.text()).slice(0,160));
  return `${URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

// Modo estrela: top faturamento (gc_vendas_item) do canal, cruzado com
// estoque>0 (gc_estoque_item) do depósito, com preço resolvido no Bling.
async function candidatosEstrela(token, canalLojaId, depositoId, limite) {
  const vendas = await sbGet(`/gc_vendas_item?select=sku,produto,faturamento&canal_loja_id=eq.${canalLojaId}`);
  const fatPorSku = new Map();
  const nomePorSku = new Map();
  for (const v of vendas) {
    if (!v.sku) continue;
    const fat = Number(v.faturamento) || 0;
    fatPorSku.set(v.sku, (fatPorSku.get(v.sku) || 0) + fat);
    if (!nomePorSku.has(v.sku)) nomePorSku.set(v.sku, v.produto);
  }

  const estoque = await sbGet(`/gc_estoque_item?select=sku,saldo&deposito_id=eq.${depositoId}`);
  const saldoPorSku = new Map();
  for (const e of estoque) {
    if (!e.sku) continue;
    const saldo = Number(e.saldo) || 0;
    saldoPorSku.set(e.sku, (saldoPorSku.get(e.sku) || 0) + saldo);
  }

  const ranked = [...fatPorSku.entries()]
    .filter(([sku, fat]) => fat > 0 && (saldoPorSku.get(sku) || 0) > 0)
    .sort((a, b) => b[1] - a[1]);

  console.log('estrela:', ranked.length, 'SKUs com faturamento + estoque no canal/depósito');

  const prodMap = await blingProdutos(token);
  const precoPorCodigo = new Map();
  for (const p of Object.values(prodMap)) {
    if (p.codigo) precoPorCodigo.set(String(p.codigo).toUpperCase(), p.preco);
  }

  const out = [];
  for (const [sku, fat] of ranked) {
    if (out.length >= limite) break;
    const preco = precoPorCodigo.get(String(sku).toUpperCase());
    if (preco == null || !(preco > 0)) { console.log('  sem preço no Bling, pulado:', sku); continue; }
    out.push({ id: null, sku, nome: nomePorSku.get(sku) || sku, preco, deposito_id: depositoId, faturamento: fat });
  }
  return out;
}

// Modo lista explícita (Estúdio): resolve nome/preço via mapa Bling (codigo.toUpperCase()->preco),
// carregando o pct e o deposito de cada item. id=null (não há candidato). Pula sem preço.
export function candsDeItens(itens, precoPorCodigo) {
  return (itens || []).map((it) => {
    const preco = precoPorCodigo[String(it.sku).toUpperCase()];
    if (preco == null) return null;
    return { id: null, sku: it.sku, nome: it.sku, preco, deposito_id: it.deposito, pct: it.pct };
  }).filter(Boolean);
}

export async function run({
  pct = 50, nome = null, parcelas = 10, limite = null, dry = false,
  loja = null, fonte = null, estrela = null, deposito = null, looks = null, modos = null, itens = null, campanhaId = null,
  objetivo = null,
} = {}) {
  const PCT = Number(pct);
  const NOME = nome || (PCT + '% OFF');
  const PARCELAS = Number(parcelas);
  const DRY = !!dry;
  const LOJA = loja;
  const FONTE = fonte;
  const ESTRELA_CANAL = estrela;
  const ESTRELA_DEPOSITO = deposito;
  // sem --limite (limite null): Infinity no modo normal, 20 candidatos no modo estrela
  const LIMITE = limite == null ? Infinity : Number(limite);
  const ESTRELA_LIMITE = limite == null ? 20 : Number(limite);

  // --looks produto-heroi,produto-sage-circulo  |  --modos avista,parcelado
  // (opts.looks/opts.modos podem chegar como string "a,b" via CLI, ou já
  // como array quando run() é chamado programaticamente)
  const LOOKS = looks == null ? null
    : Array.isArray(looks) ? looks
    : String(looks).split(',').map(s => s.trim()).filter(Boolean);
  const MODOS_MAP = { avista: false, parcelado: true };
  const MODOS = modos == null ? null
    : Array.isArray(modos) ? modos.map(m => typeof m === 'boolean' ? m : MODOS_MAP[m])
    : String(modos).split(',').map(s => s.trim()).filter(Boolean).map(s => MODOS_MAP[s]);
  const opts = {};
  if (LOOKS && LOOKS.length) opts.looks = LOOKS;
  if (MODOS && MODOS.length) opts.modos = MODOS;

  // SP-5A: os looks vêm de fabrica_looks (ativos, curados). Só filtra por objetivo quando o
  // chamador não passou --looks explícito. Soft-fail: tabela indisponível/vazia (unseeded) cai no
  // fallback SP-3; tabela POVOADA mas sem look ativo p/ o objetivo => semLooks (respeita "desligar
  // tudo": não gera nada em vez de regerar os desativados via fallback). Ver follow-up do review final.
  let semLooks = false;
  if (!(LOOKS && LOOKS.length)) {
    let usouTabela = false;
    try {
      const fabricaLooks = await sbGet('/fabrica_looks?select=chave,objetivos,ativo,ordem,tipo&order=ordem');
      usouTabela = Array.isArray(fabricaLooks) && fabricaLooks.length > 0; // tabela povoada (não unseeded)
      const ativos = looksAtivosOrdenados(fabricaLooks, objetivo).filter((k) => TEMPLATES[k]); // só code-looks conhecidos
      if (ativos.length) opts.looks = ativos;
      else if (usouTabela) semLooks = true; // povoada, nada ativo p/ este objetivo -> não gera
    } catch (e) {
      usouTabela = false;
      console.warn('aviso: fabrica_looks indisponível, fallback SP-3:', e.message);
    }
    if (!usouTabela && !semLooks && objetivo) {
      try {
        // fallback SP-3: registry + objetivosDoTemplate
        const { porChave } = await carregarObjetivos(sbGet);
        const row = mapaObjetivo(porChave, objetivo);
        const looksDisponiveis = Object.keys(TEMPLATES).filter((k) => { const o = objetivosDoTemplate(k); return o.length === 0 || o.includes(objetivo); });
        const permitidos = looksDoObjetivo(row, looksDisponiveis);
        if (permitidos.length) opts.looks = permitidos;
      } catch (e) {
        console.warn('aviso: fallback SP-3 (fabrica_objetivos) indisponível, sem filtro por objetivo:', e.message);
      }
    }
  }

  const token = await loginServico();

  let cands;
  if (itens?.length) {
    const prodMap = await blingProdutos(token);          // id -> {nome, codigo, preco}
    const precoPorCodigo = {};
    for (const p of Object.values(prodMap)) if (p.codigo) precoPorCodigo[String(p.codigo).toUpperCase()] = p.preco;
    cands = candsDeItens(itens, precoPorCodigo);
    console.log('itens | candidatos (lista explícita):', cands.length);
    for (const c of cands) console.log('  ', c.sku, '| R$', c.preco, '| pct', c.pct, '|', c.deposito_id);
  } else if (ESTRELA_CANAL) {
    if (!ESTRELA_DEPOSITO) throw new Error('--estrela requer --deposito');
    cands = await candidatosEstrela(token, ESTRELA_CANAL, ESTRELA_DEPOSITO, ESTRELA_LIMITE);
    console.log('estrela | candidatos (top faturamento c/ estoque):', cands.length);
    for (const c of cands) console.log('  ', c.sku, '| R$', c.preco, '| fat R$', c.faturamento.toFixed(2), '|', c.nome);
  } else {
    // F1 aposentada — fabrica_rodadas/fabrica_candidatos foram dropadas na
    // migration 019. Os únicos caminhos vivos são itens (Estúdio) e --estrela.
    throw new Error('gerar-criativos: forneça itens (modo Estúdio) ou --estrela <canal> --deposito <dep>');
  }

  // objetivo vira contexto de tom pra gerarCopysProduto/gerarCopyPromo (copy-efeito);
  // sem mudança obrigatória lá — o campo existe no objeto, uso é best-effort.
  const campanha = { desconto_tipo: 'fixo', desconto_pct: PCT, parcelas: PARCELAS, objetivo };

  // Marca ativa (fabrica_marcas.ativo) — parametriza o prompt do copy/legenda. O dedup dos
  // criativos é por sku (1 arte por produto, não por loja), então a marca aqui é a marca ativa
  // do momento (há 1 hoje), não a marca de um depósito específico. Resolvida em soft-fail: se
  // não vier, gerarCopysProduto cai no default ("a marca") — não quebra o gerar.
  try {
    const { marcaAtiva } = await carregarMarcasELojas(sbGet);
    campanha.marca = marcaAtiva?.nome || null;
  } catch (e) {
    console.warn('aviso: marca não resolvida (segue com default):', e.message);
    campanha.marca = null;
  }

  // campanha: quando o trigger já criou a rodada (SP-2), usa ela; senão cria (CLI legado).
  if (!DRY) {
    if (!campanhaId) {
      const c = await sbPost('/fabrica_campanhas', [{ nome: NOME, desconto_tipo: 'fixo', desconto_pct: PCT, parcelas: PARCELAS }], 'return=representation');
      campanhaId = (await c.json())[0].id;
    }
    await garantirBucket();
  }

  // produtos únicos por sku (arte é por produto, não por loja), limitados por --limite
  const vistos = new Set();
  const produtosUnicos = [];
  for (const c of cands) {
    if (c.sku && vistos.has(c.sku)) continue;
    if (c.sku) vistos.add(c.sku);
    produtosUnicos.push(c);
  }
  const produtos = produtosUnicos.slice(0, LIMITE);
  console.log('produtos únicos:', produtosUnicos.length, '| gerando para:', produtos.length);

  // copy de efeito em lote (uma chamada pros produtos + uma pra promo)
  const copys = await gerarCopysProduto(produtos.map(c => ({ sku: c.sku, nome: c.nome })), campanha);
  const copyPromo = await gerarCopyPromo(campanha);
  console.log('copy promo:', copyPromo);

  let gerados = 0;
  // dedup de foto por sku (produtos iguais em lojas diferentes)
  const fotoCache = new Map();
  const fotoDe = async (sku) => { if (!fotoCache.has(sku)) fotoCache.set(sku, await fotoDataUrl(token, sku)); return fotoCache.get(sku); };

  // PRODUTO (pulado inteiro se nenhum look ativo p/ o objetivo — respeita a curadoria)
  for (const cand of produtos) {
    if (semLooks) { console.log('  nenhum look ativo p/ o objetivo — nada gerado'); break; }
    if (cand.preco == null) { console.log('  sem preço:', cand.sku); continue; }
    const foto = await fotoDe(cand.sku);
    if (!foto) { console.warn('  sem foto:', cand.sku, cand.nome); continue; }
    if (!fotoEhStudio(cand.sku)) { console.log('  foto amadora (avaliada na foto crua), pulado:', cand.sku); continue; }
    const copyInfo = copys.get(cand.sku) || {};
    for (const v of variacoesProduto({ ...cand, fotoDataUrl: foto }, campanha, opts, cand.pct ?? campanha.desconto_pct)) {
      v.dados.copyEfeito = copyInfo.copy;
      v.dados.nome = copyInfo.nome;
      const html = TEMPLATES[v.template].render(v.dados, v.formato);
      const buf = await renderPNG(html, DIM[v.formato]);
      gerados++;
      if (DRY) { console.log('  [dry] produto', cand.sku, v.variante, v.formato, buf.length, 'bytes'); continue; }
      const path = `${campanhaId}/produto/${sane(cand.sku)}-${sane(v.variante)}-${v.formato}.png`;
      const url = await subir(path, buf);
      // candidato_id foi removido de fabrica_criativos na migration 019 (F1 aposentada — cand.id
      // já vinha sempre null no modo lista/estrela, que são os únicos caminhos vivos). Mandar essa
      // chave pro PostgREST com a coluna inexistente quebraria o insert em TODO job de verdade.
      await sbPost('/fabrica_criativos', [{ campanha_id: campanhaId, arquetipo: 'produto', template: v.template, formato: v.formato, variante: v.variante, preco_de: v.preco_de, preco_por: v.preco_por, storage_path: path, url, legenda: copyInfo.legenda || null }], 'return=minimal');
    }
  }

  // PROMO (usa a 1ª foto disponível como símbolo)
  const primeiraFoto = [...fotoCache.values()].find(Boolean) || null;
  const promoAtivo = !semLooks && (!opts.looks || opts.looks.includes('promo-number-hero'));
  if (primeiraFoto && objetivoPermitePromo(objetivo) && promoAtivo) {
    for (const v of variacoesPromo(campanha, primeiraFoto, 'Coleção')) {
      v.dados.copyEfeito = copyPromo;
      const html = TEMPLATES[v.template].render(v.dados, v.formato);
      const buf = await renderPNG(html, DIM[v.formato]);
      gerados++;
      if (DRY) { console.log('  [dry] promo', v.variante, v.formato, buf.length, 'bytes'); continue; }
      const path = `${campanhaId}/promo/${sane(v.variante)}-${v.formato}.png`;
      const url = await subir(path, buf);
      // promo: copyPromo é a linha CURTA da arte (~40 chars), não um texto de anúncio persuasivo —
      // deixa legenda null pra o subir cair na legenda de marca (fallback) nesse criativo.
      await sbPost('/fabrica_criativos', [{ campanha_id: campanhaId, arquetipo: 'promo', template: v.template, formato: v.formato, variante: v.variante, storage_path: path, url, legenda: null }], 'return=minimal');
    }
  }

  await fecharRender();
  console.log(DRY ? `\n(--dry) geraria ${gerados} criativos.` : `\ngerado: ${gerados} criativos | campanha ${campanhaId}`);
  return { campanhaId, criativos: gerados };
}

function flag(f, d) { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d; }
if (import.meta.url === `file://${process.argv[1]}`) {
  run({
    pct: Number(flag('--pct', 50)), nome: flag('--nome', null),
    parcelas: Number(flag('--parcelas', 10)), limite: flag('--limite') ? Number(flag('--limite')) : null,
    dry: process.argv.includes('--dry'), loja: flag('--loja', null), fonte: flag('--fonte', null),
    estrela: flag('--estrela', null), deposito: flag('--deposito', null),
    looks: flag('--looks', null), modos: flag('--modos', null),
  }).then((r) => console.log('gerar concluído:', r)).catch(async (e) => { await fecharRender(); console.error('FALHOU:', e.message); process.exit(1); });
}
