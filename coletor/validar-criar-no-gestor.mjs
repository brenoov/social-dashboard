#!/usr/bin/env node
// VALIDAÇÃO AO VIVO DA CADEIA CAMPANHA → CONJUNTO → ANÚNCIO.
//
// POR QUE ANTES DA TELA: criar campanha do zero no Gestor (o "C3") é a peça que
// falta, e a parte que NUNCA funcionou é a última — o anúncio. As tentativas
// anteriores morreram em quatro recusas seguidas da Meta, e três delas por
// incompatibilidade entre o criativo que eu reusava e o conjunto que eu montava:
//
//   4834011 — faltava is_adset_budget_sharing_enabled
//   1870227 — faltava advantage_audience: 0 junto de idade manual
//   1885154 e 1487891 — criativo de WhatsApp num conjunto que não era de WhatsApp
//
// A LIÇÃO QUE ESTE SCRIPT APLICA: não reusar criativo achado por aí. O
// `payloadCriativa` da Fábrica monta o criativo A PARTIR DO DESTINO DO CONJUNTO,
// então ele casa por construção. E o `payloadCampanhaAdset` já manda os dois
// campos que faltavam. Os dois estão em produção há meses.
//
// Escrever tela sobre payload não provado é o caminho mais caro que existe: o
// erro aparece no clique do dono, numa conta ao vivo.
//
// Cria tudo PAUSED e apaga no fim. Nada é ativado; campanha pausada não gasta.
//
// Uso: node --import ./lib/curl-fetch.mjs validar-criar-no-gestor.mjs [--manter]
import './lib/carregar-env.mjs';
import tls from 'node:tls';
import { loginServico } from './lib/bling-comercial.mjs';
import { carregarMarcasELojas } from './lib/config-lojas.mjs';
import { carregarObjetivos, mapaObjetivo } from './lib/objetivos.mjs';
import { payloadCampanhaAdset, resolverLoja } from './subir-estudio.mjs';
import { payloadCriativa } from './lib/meta-subir.mjs';

tls.DEFAULT_MAX_VERSION = 'TLSv1.2';

const URL_SB = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvdW5xdGRvaW9vb3R4cWVna2lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMDMwMDUsImV4cCI6MjA5NDc3OTAwNX0.MVXa6jngjKXkH3eZ7as_j_k8Eb7lJKcFmO4kCKAnuHM';
const SK = process.env.SUPABASE_SERVICE_KEY;
const REST = URL_SB + '/rest/v1';
const MANTER = process.argv.includes('--manter');

let TOKEN;
const sbGet = async (p) => { const r = await fetch(REST + p, { headers: { apikey: SK, Authorization: 'Bearer ' + SK } }); if (!r.ok) throw new Error('GET ' + r.status); return r.json(); };
async function proxy(body) {
  const r = await fetch(URL_SB + '/functions/v1/meta-proxy', {
    method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, d: await r.json().catch(() => ({})) };
}
// SEM TRUNCAR: cortar a mensagem da Meta escondeu a resposta três vezes nesta
// série de investigações. A explicação vive no fim.
const erro = (d) => {
  const e = d && d.error;
  if (!e) return JSON.stringify(d).slice(0, 300);
  return [`code ${e.code}${e.error_subcode ? '/' + e.error_subcode : ''}`,
    e.message && `message: ${e.message}`,
    e.error_user_title && `título: ${e.error_user_title}`,
    e.error_user_msg && `explicação: ${e.error_user_msg}`,
    e.fbtrace_id && `fbtrace: ${e.fbtrace_id}`].filter(Boolean).join('\n      ');
};

const provas = [];
const conferir = (nome, ok, detalhe) => {
  provas.push({ nome, ok: !!ok });
  console.log(`  ${ok ? '✓' : '✗'} ${nome}${detalhe ? ' — ' + detalhe : ''}`);
};

async function main() {
  TOKEN = await loginServico();
  const { lojas, marcaAtiva } = await carregarMarcasELojas(sbGet);
  const loja = resolverLoja(lojas, 'tivoli') || (lojas || [])[0];
  const marca = (loja && loja.marca) || marcaAtiva;
  const acct = marca.accountId, act = marca.adAccount;
  const { porChave } = await carregarObjetivos(sbGet);

  console.log(`\n=== CRIAR do zero · ${marca.nome} · ${act} ===\n`);

  // FAXINA de rodadas anteriores, pelo prefixo do nome. Só o que este script cria.
  const PREFIXO = '[VALIDA C3]';
  const velhas = await proxy({ accountId: acct, path: `/${act}/campaigns`, method: 'GET',
    params: { fields: 'id,name,status', limit: 100, filtering: JSON.stringify([{ field: 'name', operator: 'CONTAIN', value: PREFIXO }]) } });
  for (const c of ((velhas.d && velhas.d.data) || [])) {
    if (String(c.status).toUpperCase() === 'DELETED') continue;
    await proxy({ accountId: acct, path: `/${c.id}`, method: 'POST', params: { status: 'DELETED' } });
    console.log(`🧹 sobra apagada: ${c.name}`);
  }

  // UMA IMAGEM QUE JÁ EXISTE na conta. Subir imagem nova é outro problema (e
  // outro custo); o que se testa aqui é a CADEIA, não o upload.
  const rimg = await proxy({ accountId: acct, path: `/${act}/adimages`, method: 'GET', params: { fields: 'hash,name', limit: 1 } });
  const img = rimg.d && rimg.d.data && rimg.d.data[0];
  if (!img) { console.log('✗ a conta não tem nenhuma imagem para reusar'); process.exit(1); }
  console.log(`imagem reusada: ${img.hash.slice(0, 18)}…\n`);

  // Testa OS QUATRO objetivos que a Fábrica conhece, não um só: a tela vai
  // oferecer todos, e cada um monta campanha e criativo diferentes. Um que
  // funcione não prova nada sobre os outros — foi assim que o Duplicar
  // pareceu inteiro por semanas.
  const OBJETIVOS = ['engajamento', 'conversao', 'trafego', 'branding'];
  for (const chave of OBJETIVOS) {
    const row = mapaObjetivo(porChave, chave);
    if (!row) { conferir(`objetivo "${chave}" existe em fabrica_objetivos`, false); continue; }
    console.log(`── ${chave} (${row.meta_objective} / ${row.optimization_goal})`);
    let campanhaId = null;
    try {
      const { campaign, adset } = payloadCampanhaAdset(row, marca, loja, { DAILY_BUDGET: 5000, DATA: 'VALIDA-C3' });
      campaign.name = `${PREFIXO} ${chave} — apagar`;
      adset.name = `${PREFIXO} conjunto ${chave}`;

      const rc = await proxy({ accountId: acct, path: `/${act}/campaigns`, method: 'POST', params: campaign });
      if (rc.status !== 200 || !rc.d?.id) { conferir(`campanha (${chave})`, false, erro(rc.d)); continue; }
      campanhaId = rc.d.id;
      conferir(`campanha criada (${chave})`, true, campanhaId);

      const ra = await proxy({ accountId: acct, path: `/${act}/adsets`, method: 'POST', params: { ...adset, campaign_id: campanhaId } });
      if (ra.status !== 200 || !ra.d?.id) { conferir(`conjunto (${chave})`, false, erro(ra.d)); continue; }
      const conjuntoId = ra.d.id;
      conferir(`conjunto criado (${chave})`, true, conjuntoId);

      // O CRIATIVO SAI DO DESTINO DO CONJUNTO — é isso que faz ele casar.
      const criativo = payloadCriativa({
        hash: img.hash, adsetDestinationType: row.destination_type,
        waNumero: loja.whatsapp, page: marca.pageId, ig: marca.igId,
        mensagem: 'Validação automática — este anúncio nasce pausado e é apagado em seguida.',
      });
      const rcr = await proxy({ accountId: acct, path: `/${act}/adcreatives`, method: 'POST', params: { name: `${PREFIXO} criativo ${chave}`, ...criativo } });
      if (rcr.status !== 200 || !rcr.d?.id) { conferir(`criativo (${chave})`, false, erro(rcr.d)); continue; }
      conferir(`criativo criado (${chave})`, true, rcr.d.id);

      const rad = await proxy({ accountId: acct, path: `/${act}/ads`, method: 'POST', params: {
        name: `${PREFIXO} anúncio ${chave}`, adset_id: conjuntoId, creative: { creative_id: rcr.d.id }, status: 'PAUSED',
      } });
      if (rad.status !== 200 || !rad.d?.id) { conferir(`ANÚNCIO (${chave})`, false, erro(rad.d)); continue; }
      conferir(`ANÚNCIO criado (${chave})`, true, rad.d.id);

      // Lê de volta: aceitar não é o mesmo que guardar, e PAUSED é a promessa
      // mais importante deste caminho — é o que garante que nada gasta.
      const rl = await proxy({ accountId: acct, path: `/${rad.d.id}`, method: 'GET', params: { fields: 'status,adset_id' } });
      conferir(`nasceu PAUSED (${chave})`, String(rl.d?.status).toUpperCase() === 'PAUSED', rl.d?.status);
      conferir(`entrou no conjunto certo (${chave})`, String(rl.d?.adset_id) === String(conjuntoId));
    } finally {
      if (campanhaId && !MANTER) {
        // TENTA DE NOVO antes de desistir. Na primeira rodada uma das quatro não
        // foi apagada — a Meta recusou uma vez e o script seguiu em frente,
        // deixando campanha de teste na conta do dono. Uma falha transitória não
        // pode virar lixo permanente, e a faxina do começo só limparia na PRÓXIMA
        // execução, que pode não acontecer.
        let apagou = false;
        for (let tentativa = 1; tentativa <= 3 && !apagou; tentativa++) {
          const rd = await proxy({ accountId: acct, path: `/${campanhaId}`, method: 'POST', params: { status: 'DELETED' } });
          apagou = rd.status === 200 && !rd.d?.error;
          if (!apagou) {
            console.log(`  ⚠ tentativa ${tentativa} de apagar falhou: ${erro(rd.d)}`);
            await new Promise((r) => setTimeout(r, 1500 * tentativa));
          }
        }
        console.log(`  🗑 ${apagou ? 'apagada' : 'NÃO APAGOU — apague na mão: ' + campanhaId}`);
        if (!apagou) provas.push({ nome: 'limpeza da campanha ' + campanhaId, ok: false });
      }
    }
  }

  const falhas = provas.filter((p) => !p.ok);
  console.log(`\n=== ${provas.length - falhas.length}/${provas.length} conferências passaram ===`);
  if (falhas.length) process.exit(1);
}
main().catch((e) => { console.error('FATAL:', (e && e.message) || e); process.exit(1); });
