// SONDA DOS POSICIONAMENTOS — o que os conjuntos REAIS desta conta têm hoje.
//
// POR QUE ANTES DE CONSTRUIR: a ideia é deixar o Gestor editar posicionamento
// (feed / story / reels) no mesmo editor de público. Os nomes dos campos
// (`publisher_platforms`, `facebook_positions`, `instagram_positions`) aparecem
// no `regrasPlacement` da Fábrica e são ACEITOS pelo Graph — só que lá eles
// moram no CRIATIVO (`asset_customization_rules`), e aqui morariam no
// TARGETING do conjunto. Campo de mesmo nome em lugar diferente é exatamente o
// tipo de suposição que já custou rodada neste projeto.
//
// Esta sonda responde o que a documentação não decide:
//   1. Quais conjuntos desta conta declaram posicionamento e quais deixam
//      automático (campo AUSENTE = automático, e é a maioria).
//   2. Que VALORES aparecem de verdade — é a lista contra a qual a tela deve
//      oferecer opções, em vez de uma lista tirada da doc.
//   3. Se há campo de posicionamento que o editor NÃO gerenciaria e que
//      precisaria ser preservado (a mesma dívida que geo_locations já tem).
//
// CUSTA R$ 0: nenhuma IA. Só GETs no Graph via meta-proxy. NÃO GRAVA NADA.
import { loginServico } from './lib/bling-comercial.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ANON = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvdW5xdGRvaW9vb3R4cWVna2lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMDMwMDUsImV4cCI6MjA5NDc3OTAwNX0.MVXa6jngjKXkH3eZ7as_j_k8Eb7lJKcFmO4kCKAnuHM';
const REST = SUPABASE_URL + '/rest/v1';

// Todo campo de posicionamento que a Meta pode devolver no targeting. A lista é
// LARGA de propósito: o que interessa aqui é descobrir o que EXISTE nesta conta,
// e um campo que a gente não conhecesse passaria despercebido se a sonda só
// olhasse os quatro que a tela pretende desenhar.
const CAMPOS = [
  'publisher_platforms',
  'facebook_positions', 'instagram_positions',
  'messenger_positions', 'audience_network_positions',
  'threads_positions', 'oculus_positions', 'whatsapp_positions',
  'device_platforms', 'effective_publisher_platforms',
  'effective_facebook_positions', 'effective_instagram_positions',
];

async function meta(accountId, path, params, token) {
  const r = await fetch(SUPABASE_URL + '/functions/v1/meta-proxy', {
    method: 'POST',
    headers: { apikey: ANON, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId, path, params, method: 'GET' }),
  });
  if (!r.ok) throw new Error('meta-proxy ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}

async function run() {
  if (!SERVICE_KEY) throw new Error('falta SUPABASE_SERVICE_KEY');
  const token = await loginServico();
  const marcas = await fetch(REST + '/fabrica_marcas?select=nome,account_id,ad_account&ativo=eq.true', {
    headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY },
  }).then((r) => r.json());
  const marca = (marcas || []).find((m) => m && m.account_id && m.ad_account);
  if (!marca) throw new Error('nenhuma marca ativa com conta de anúncios');

  console.log(`SONDA de posicionamentos · ${marca.nome} · ${marca.ad_account} · sem IA, custo R$ 0\n`);

  const resp = await meta(marca.account_id, `/${marca.ad_account}/adsets`,
    { fields: 'id,name,effective_status,targeting', limit: 50 }, token);
  const linhas = (resp && resp.data) || [];
  if (!linhas.length) { console.error('nenhum conjunto voltou — falha de acesso, não resposta da conta'); process.exit(1); }

  console.log(`${linhas.length} conjuntos lidos.\n`);

  // Quantos declaram posicionamento, e quais valores aparecem. É a resposta que
  // decide se a tela mostra "automático" como estado normal ou como exceção.
  const vistos = {};       // campo -> Set de valores
  let comPlataformas = 0;
  const exemplos = [];

  for (const s of linhas) {
    const t = (s && s.targeting) || {};
    const presentes = CAMPOS.filter((c) => t[c] != null);
    if (t.publisher_platforms != null) comPlataformas++;
    for (const c of presentes) {
      vistos[c] = vistos[c] || new Set();
      for (const v of (Array.isArray(t[c]) ? t[c] : [t[c]])) vistos[c].add(String(v));
    }
    if (presentes.length && exemplos.length < 6) {
      exemplos.push({ nome: s.name, status: s.effective_status, campos: presentes.map((c) => `${c}=[${(t[c] || []).join(', ')}]`) });
    }
  }

  console.log(`Declaram \`publisher_platforms\` (posicionamento MANUAL): ${comPlataformas} de ${linhas.length}`);
  console.log(`Deixam automático (campo ausente): ${linhas.length - comPlataformas}\n`);

  console.log('VALORES QUE APARECEM DE VERDADE NESTA CONTA:');
  const achou = Object.keys(vistos);
  if (!achou.length) console.log('  nenhum — todos os conjuntos estão em automático');
  for (const c of achou) console.log(`  ${c}: ${[...vistos[c]].sort().join(' · ')}`);

  if (exemplos.length) {
    console.log('\nEXEMPLOS (conjuntos que declaram algo):');
    for (const e of exemplos) {
      console.log(`  "${e.nome}" [${e.status}]`);
      for (const c of e.campos) console.log(`      ${c}`);
    }
  }

  // O que o editor precisaria PRESERVAR: campo de posicionamento que existe na
  // conta e que a tela não pretende desenhar. Mesma dívida do geo_locations —
  // montar o objeto do zero apagaria escolha que o dono fez em outro lugar.
  const DESENHADOS = ['publisher_platforms', 'facebook_positions', 'instagram_positions'];
  const preservar = achou.filter((c) => !DESENHADOS.includes(c) && !c.startsWith('effective_'));
  console.log('\nPRECISARIA PRESERVAR (existe na conta e a tela não desenharia):');
  console.log(preservar.length ? '  ' + preservar.join(' · ') : '  nada');
}

run().catch((e) => { console.error(String((e && e.stack) || e)); process.exit(1); });
