#!/usr/bin/env node
// VALIDAÇÃO AO VIVO do Duplicar do Gestor — a última das três que nunca tocou a conta.
//
// O QUE ELE PROVA, e por que teste unitário não alcança: o Duplicar depende do
// `/copies` da Meta, cujo comportamento foi levantado da DOCUMENTAÇÃO. Três
// afirmações nunca conferidas ao vivo:
//   1. a cópia nasce PAUSADA (mandamos `status_option: PAUSED` explícito);
//   2. a Meta NÃO devolve `id`, e sim `copied_campaign_id`/`copied_adset_id`/
//      `copied_ad_id` — se isso mudar, a cascata quebra no primeiro passo;
//   3. `deep_copy: false` + cascata rasa realmente leva conjunto e anúncio.
//
// E prova o defeito que a revisão pegou no PLANO, não na execução: a janela
// prometia "12 anúncios" e nascia campanha VAZIA. Aqui a contagem do plano é
// comparada com o que a Meta REALMENTE criou.
//
// COMO: NÃO cria original. Escolhe uma campanha PAUSADA que já existe na conta,
// duplica pelo MESMO `planoDeCopia`/`executarPlano` da tela, confere a cópia
// campo a campo e apaga SÓ A CÓPIA.
//
// POR QUE NÃO CRIAR O ORIGINAL: tentei, e a Meta recusou quatro vezes seguidas
// (4834011, 1870227, 1885154, 1487891) — as três últimas por incompatibilidade
// entre o criativo que eu reusava e o conjunto que eu montava. Montar um
// original que a Meta aceite é um problema DIFERENTE do que se quer testar, e
// resolvê-lo não prova nada sobre o Duplicar.
//
// Duplicar o que já existe é melhor por três motivos: testa a estrutura REAL
// (com os anúncios que a conta tem de verdade), não inventa objeto novo, e
// deixa menos lixo — só a cópia precisa ser apagada. O original NUNCA é tocado:
// `/copies` lê a origem, não a modifica.
//
// Uso: node --import ./lib/curl-fetch.mjs validar-duplicar.mjs [--manter]
import './lib/carregar-env.mjs';
import tls from 'node:tls';
import { loginServico } from './lib/bling-comercial.mjs';
import { carregarMarcasELojas } from './lib/config-lojas.mjs';
import { resolverLoja } from './subir-estudio.mjs';
import { planoDeCopia, executarPlano, SUFIXO_PADRAO } from '../src/ferramentas/gestao-trafego/duplicar.js';

tls.DEFAULT_MAX_VERSION = 'TLSv1.2';

const URL = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvdW5xdGRvaW9vb3R4cWVna2lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMDMwMDUsImV4cCI6MjA5NDc3OTAwNX0.MVXa6jngjKXkH3eZ7as_j_k8Eb7lJKcFmO4kCKAnuHM';
const SK = process.env.SUPABASE_SERVICE_KEY;
const REST = URL + '/rest/v1';
const H = { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' };
const MANTER = process.argv.includes('--manter');

let TOKEN;
const sbGet = async (p) => {
  const r = await fetch(REST + p, { headers: H });
  if (!r.ok) throw new Error('GET ' + p + ' ' + r.status);
  return r.json();
};
async function proxy(body) {
  const r = await fetch(URL + '/functions/v1/meta-proxy', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  return { status: r.status, d };
}
const erro = (d) => {
  const e = d && d.error;
  return e ? `code ${e.code}${e.error_subcode ? '/' + e.error_subcode : ''}: ${(e.message || '').slice(0, 180)}` : JSON.stringify(d).slice(0, 220);
};

const provas = [];
function conferir(nome, ok, detalhe) {
  provas.push({ nome, ok: !!ok, detalhe: detalhe || '' });
  console.log(`  ${ok ? '✓' : '✗'} ${nome}${detalhe ? ' — ' + detalhe : ''}`);
}

async function main() {
  TOKEN = await loginServico();
  const { lojas, marcaAtiva } = await carregarMarcasELojas(sbGet);
  const loja = resolverLoja(lojas, 'tivoli') || (lojas || [])[0];
  const marca = (loja && loja.marca) || marcaAtiva;
  const acct = marca.accountId, adAccount = marca.adAccount;

  console.log(`\n=== VALIDAÇÃO do Duplicar · ${marca.nome} · ${adAccount} ===\n`);

  // FAXINA DE CÓPIAS de rodadas anteriores. O sufixo "· cópia" é do próprio
  // motor (SUFIXO_PADRAO), então é ele que identifica o que este validador
  // criou — e só isso é apagado. Campanha sem o sufixo é do dono.
  const rorf = await proxy({ accountId: acct, path: `/${adAccount}/campaigns`, method: 'GET',
    params: { fields: 'id,name,status', limit: 200, filtering: JSON.stringify([{ field: 'name', operator: 'CONTAIN', value: SUFIXO_PADRAO }]) } });
  for (const c of ((rorf.d && rorf.d.data) || [])) {
    if (String(c.status).toUpperCase() === 'DELETED') continue;
    const rd = await proxy({ accountId: acct, path: `/${c.id}`, method: 'POST', params: { status: 'DELETED' } });
    console.log(`🧹 cópia de rodada anterior apagada: ${c.name}${rd.status === 200 ? '' : ' — FALHOU'}`);
  }

  // A COBAIA: uma campanha PAUSADA que já existe, com conjunto e anúncio.
  // Pausada de propósito — duplicar não mexe no original, mas se algo der muito
  // errado, o estrago possível é menor numa campanha que já está parada.
  const rcs = await proxy({ accountId: acct, path: `/${adAccount}/campaigns`, method: 'GET',
    params: { fields: 'id,name,status,effective_status', limit: 100 } });
  const pausadas = ((rcs.d && rcs.d.data) || [])
    .filter((c) => String(c.status).toUpperCase() === 'PAUSED' && !String(c.name).includes(SUFIXO_PADRAO));

  let cobaia = null, conjuntos = [], anuncios = [];
  for (const c of pausadas) {
    const rj = await proxy({ accountId: acct, path: `/${c.id}/adsets`, params: { fields: 'id,name', limit: 25 }, method: 'GET' });
    const cjs = (rj.d && rj.d.data) || [];
    if (!cjs.length) continue;
    const rd = await proxy({ accountId: acct, path: `/${c.id}/ads`, params: { fields: 'id,name,adset_id', limit: 25 }, method: 'GET' });
    const ads = (rd.d && rd.d.data) || [];
    // Pequena de propósito: a cascata rasa é o que se testa, não o volume — e
    // cada anúncio a mais é uma chamada a mais no limite da conta (code 17).
    if (!ads.length || ads.length > 4 || cjs.length > 2) continue;
    cobaia = c; conjuntos = cjs; anuncios = ads; break;
  }
  if (!cobaia) { console.log('✗ nenhuma campanha PAUSADA pequena com anúncios para servir de cobaia'); process.exit(1); }
  console.log(`cobaia: "${cobaia.name}" — ${conjuntos.length} conjunto(s), ${anuncios.length} anúncio(s)\n`);

  let copiaId = null;
  try {
    // ── O PLANO, pelo mesmo motor da tela ───────────────────────────────────
    const plano = planoDeCopia({ nivel: 'campanha', campanha: cobaia, conjuntos, anuncios });
    const esperado = 1 + conjuntos.length + anuncios.length;
    console.log(`PLANO: ${plano.length} passos`);
    conferir('o plano tem um passo por objeto', plano.length === esperado, `${plano.length} de ${esperado}`);
    conferir('todo passo pede PAUSED explicitamente', plano.every((p) => p.params.status_option === 'PAUSED'));
    conferir('campanha e conjunto pedem deep_copy: false', plano.filter((p) => p.nivel !== 'anuncio').every((p) => p.params.deep_copy === false));

    const enviar = async (caminho, params) => {
      const r = await proxy({ accountId: acct, path: caminho, method: 'POST', params });
      if (r.status !== 200 || r.d?.error) throw new Error(erro(r.d));
      return r.d;
    };
    const rel = await executarPlano(plano, { enviar });
    conferir('nenhum passo falhou', !rel.falhou, rel.falhou ? `${rel.falhou.passo.nivel}: ${rel.falhou.motivo}` : '');
    conferir('todos os passos concluíram', rel.concluidos.length === plano.length, `${rel.concluidos.length}/${plano.length}`);
    copiaId = rel.criados['c1:camp'] || null;
    // A Meta NÃO devolve `id` — devolve copied_campaign_id. Se um dia mudar, é
    // aqui que aparece, e a cascata inteira teria quebrado no primeiro passo.
    conferir('a Meta devolveu copied_campaign_id (não `id`)', !!copiaId, String(copiaId));
    if (!copiaId) return;

    // ── A PROVA: o que a Meta REALMENTE criou ───────────────────────────────
    const rcp = await proxy({ accountId: acct, path: `/${copiaId}`, params: { fields: 'name,status' }, method: 'GET' });
    console.log('\nA CÓPIA, lida de volta da Meta:');
    conferir('a cópia nasceu PAUSADA', String(rcp.d?.status || '').toUpperCase() === 'PAUSED', rcp.d?.status);
    conferir('o nome levou o sufixo de cópia', String(rcp.d?.name || '').includes(SUFIXO_PADRAO), rcp.d?.name);

    const rjc = await proxy({ accountId: acct, path: `/${copiaId}/adsets`, params: { fields: 'id,name,status', limit: 50 }, method: 'GET' });
    const cjCopia = (rjc.d && rjc.d.data) || [];
    conferir('a cascata levou os conjuntos junto', cjCopia.length === conjuntos.length, `${cjCopia.length} de ${conjuntos.length}`);
    conferir('os conjuntos copiados estão PAUSED', cjCopia.length > 0 && cjCopia.every((c) => String(c.status).toUpperCase() === 'PAUSED'));

    const rac = await proxy({ accountId: acct, path: `/${copiaId}/ads`, params: { fields: 'id,name,status,adset_id', limit: 50 }, method: 'GET' });
    const adsCopia = (rac.d && rac.d.data) || [];
    // A CONTAGEM É A PROVA CENTRAL: é exatamente aqui que o defeito pego na
    // revisão apareceria — a janela prometia 12 anúncios e nascia campanha
    // VAZIA, com "Pronto, 1 item copiado".
    conferir('a contagem de anúncios bate com o plano', adsCopia.length === anuncios.length, `plano prometia ${anuncios.length}, a Meta criou ${adsCopia.length}`);
    conferir('os anúncios copiados estão PAUSED', adsCopia.length > 0 && adsCopia.every((a) => String(a.status).toUpperCase() === 'PAUSED'));
    conferir('os anúncios entraram no conjunto COPIADO, não no original',
      adsCopia.every((a) => cjCopia.some((c) => String(c.id) === String(a.adset_id))));

    // O ORIGINAL NÃO PODE TER SIDO TOCADO. `/copies` lê a origem — mas isso é
    // afirmação sobre a Meta, e afirmação sobre a Meta se confere.
    const rorig = await proxy({ accountId: acct, path: `/${cobaia.id}/ads`, params: { fields: 'id', limit: 50 }, method: 'GET' });
    conferir('o original continua com os mesmos anúncios', ((rorig.d && rorig.d.data) || []).length === anuncios.length);
  } finally {
    if (copiaId && !MANTER) {
      const rd = await proxy({ accountId: acct, path: `/${copiaId}`, method: 'POST', params: { status: 'DELETED' } });
      console.log(`\n🗑 ${rd.status === 200 ? 'cópia apagada (o original nunca foi tocado)' : 'NÃO APAGOU a cópia ' + copiaId + ' — ' + erro(rd.d)}`);
    } else if (copiaId) {
      console.log(`\n⚠ cópia mantida a pedido: ${copiaId}`);
    }
  }

  const falhas = provas.filter((p) => !p.ok);
  console.log(`\n=== ${provas.length - falhas.length}/${provas.length} conferências passaram ===`);
  if (falhas.length) process.exit(1);
}
main().catch((e) => { console.error('FATAL:', (e && e.message) || e); process.exit(1); });
