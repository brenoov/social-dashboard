#!/usr/bin/env node
// SONDA DO APP REVIEW — o que o app JÁ pode, e o que falta pedir à Meta.
//
// POR QUE ANTES DE MONTAR O PEDIDO: o App Review é um formulário manual, com
// vídeo de tela e descrição de cada permissão, e refazê-lo custa semanas de
// espera. Pedir permissão que já se tem é ruído; deixar de pedir uma que falta
// é reprovação. As duas coisas se resolvem OLHANDO, e a resposta está a uma
// chamada de leitura de distância.
//
// A PERGUNTA REAL É DUPLA, e é fácil confundir as duas:
//   1. O TOKEN tem o escopo? (`/me/permissions`)
//   2. O APP tem ACESSO AVANÇADO àquele escopo?
// Um app em desenvolvimento concede tudo para quem é admin dele — então o token
// do dono pode ter `instagram_content_publish` e a publicação continuar
// falhando para qualquer outra pessoa. É por isso que esta sonda não pergunta
// só "tem o escopo", e sim tenta os endpoints que a permissão destranca.
//
// LEITURA PURA. Não publica, não cria contêiner de mídia, não gasta. O endpoint
// `content_publishing_limit` é o teste honesto de "posso publicar?": ele exige
// a mesma permissão da publicação e não publica nada.
//
// Uso: node --import ./lib/curl-fetch.mjs sondar-app-review.mjs
import './lib/carregar-env.mjs';
import tls from 'node:tls';
import { loginServico } from './lib/bling-comercial.mjs';
import { carregarMarcasELojas } from './lib/config-lojas.mjs';

tls.DEFAULT_MAX_VERSION = 'TLSv1.2';

const URL_SB = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvdW5xdGRvaW9vb3R4cWVna2lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMDMwMDUsImV4cCI6MjA5NDc3OTAwNX0.MVXa6jngjKXkH3eZ7as_j_k8Eb7lJKcFmO4kCKAnuHM';
const SK = process.env.SUPABASE_SERVICE_KEY;
const REST = URL_SB + '/rest/v1';

let TOKEN;
const sbGet = async (p) => { const r = await fetch(REST + p, { headers: { apikey: SK, Authorization: 'Bearer ' + SK } }); if (!r.ok) throw new Error('GET ' + r.status); return r.json(); };
async function proxy(body) {
  const r = await fetch(URL_SB + '/functions/v1/meta-proxy', {
    method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, d: await r.json().catch(() => ({})) };
}

// O ERRO INTEIRO, sempre. Truncar segurou três investigações nesta série — e
// aqui é pior: o motivo de uma recusa de permissão vive INTEIRO no
// `error_user_msg`, que é justamente a parte que um `slice(0,180)` come.
function erroCompleto(d) {
  const e = d && d.error;
  if (!e) return JSON.stringify(d).slice(0, 400);
  const partes = [`code ${e.code}${e.error_subcode ? '/' + e.error_subcode : ''}`];
  if (e.message) partes.push(`message: ${e.message}`);
  if (e.type) partes.push(`type: ${e.type}`);
  if (e.error_user_title) partes.push(`título: ${e.error_user_title}`);
  if (e.error_user_msg) partes.push(`explicação: ${e.error_user_msg}`);
  if (e.fbtrace_id) partes.push(`fbtrace: ${e.fbtrace_id}`);
  return partes.join('\n      ');
}

// AS PERMISSÕES QUE ESTE PROJETO USA, e o que cada uma destranca aqui dentro.
// A coluna do meio é o que vai no formulário do App Review: a Meta reprova
// descrição genérica ("para gerenciar anúncios"), e aceita a que aponta a tela.
const PRECISA = [
  ['ads_management', 'Gestão de Tráfego: criar/pausar campanha, conjunto e anúncio, e mudar orçamento'],
  ['ads_read', 'Dashboards de desempenho: gasto, resultados e custo por resultado'],
  ['business_management', 'Ler as contas de anúncio do Business e resolver marca/loja'],
  ['pages_show_list', 'Descobrir a página ligada à marca'],
  ['pages_read_engagement', 'Ler alcance/engajamento dos posts da página'],
  // AUSENTE DE PROPÓSITO: `pages_manage_posts`. Nenhum código nosso publica em
  // Página do Facebook — a Central de Conteúdo é só Instagram. Listar aqui faria
  // a sonda cobrar uma permissão que ninguém usa, e pedir permissão sem uso é
  // reprovação certa no App Review (a Meta não a vê sendo usada no vídeo).
  ['instagram_basic', 'Ler perfil e mídias do Instagram da marca'],
  ['instagram_manage_insights', 'Dashboard de Redes: seguidores, alcance e engajamento'],
  ['instagram_content_publish', 'Central de Conteúdo: publicar sozinho o post aprovado no Instagram'],
];

const linha = (ok, txt) => console.log(`   ${ok ? '✓' : '✗'} ${txt}`);

async function main() {
  TOKEN = await loginServico();
  const { lojas, marcaAtiva } = await carregarMarcasELojas(sbGet);
  const marca = (((lojas || []).find((l) => l.marca) || {}).marca) || marcaAtiva;
  if (!marca) { console.log('✗ nenhuma marca cadastrada — nada a sondar'); process.exit(1); }
  const acct = marca.accountId;

  console.log(`SONDA de App Review · ${marca.nome} · leitura pura, custo R$ 0\n`);
  console.log(`   página: ${marca.pageId || '(não cadastrada)'} · instagram: ${marca.igId || '(não cadastrado)'}\n`);

  // ── 1. O QUE O TOKEN DIZ TER ─────────────────────────────────────────────
  console.log('── 1. Escopos do token (o que ele DIZ ter)');
  const perm = await proxy({ accountId: acct, path: '/me/permissions', method: 'GET' });
  const linhas = (perm.d && perm.d.data) || [];
  if (!linhas.length) console.log(`   ⚠ não consegui ler: ${erroCompleto(perm.d)}`);
  const concedidas = new Set(linhas.filter((p) => p.status === 'granted').map((p) => p.permission));
  const recusadas = linhas.filter((p) => p.status !== 'granted').map((p) => p.permission);
  for (const [chave, uso] of PRECISA) linha(concedidas.has(chave), `${chave.padEnd(28)} ${uso}`);
  if (recusadas.length) console.log(`   recusadas explicitamente: ${recusadas.join(', ')}`);
  const extras = [...concedidas].filter((c) => !PRECISA.some(([k]) => k === c));
  if (extras.length) console.log(`   (o token tem, e este projeto não usa: ${extras.join(', ')})`);

  // ── 2. QUEM É O APP ──────────────────────────────────────────────────────
  //
  // O modo do app decide o que a lista acima significa. Em DESENVOLVIMENTO, ele
  // concede tudo a quem é admin — a lista fica verde e engana. Só em modo LIVE,
  // com acesso avançado, ela vale para os outros usuários.
  console.log('\n── 2. O app');
  const app = await proxy({ accountId: acct, path: '/app', method: 'GET', params: { fields: 'id,name,category,link' } });
  if (app.d && app.d.error) console.log(`   ⚠ não consegui ler /app: ${erroCompleto(app.d)}`);
  else console.log(`   ${app.d.name || '(sem nome)'} · id ${app.d.id} · ${app.d.category || 'sem categoria'}`);
  console.log('   → o MODO (desenvolvimento × live) e o nível de acesso de cada permissão');
  console.log('     NÃO saem da API: só o painel em developers.facebook.com mostra.');

  // ── 3. O QUE DE FATO DESTRANCA ───────────────────────────────────────────
  //
  // Esta é a parte que importa. Escopo concedido e endpoint funcionando são
  // coisas diferentes — e é o endpoint que o dono vai clicar.
  console.log('\n── 3. Os endpoints que cada permissão destranca (a prova real)');

  const provas = [];
  const tentar = async (nome, corpo, permissao) => {
    const r = await proxy(corpo);
    const ok = !(r.d && r.d.error);
    provas.push({ nome, ok, permissao });
    if (ok) console.log(`   ✓ ${nome}`);
    else console.log(`   ✗ ${nome}  (depende de ${permissao})\n      ${erroCompleto(r.d)}`);
    return r;
  };

  await tentar('ler as contas de anúncio do Business', { accountId: acct, path: '/me/adaccounts', method: 'GET', params: { fields: 'id,name', limit: 3 } }, 'business_management/ads_read');

  if (marca.pageId) {
    await tentar('ler a página da marca', { accountId: acct, path: `/${marca.pageId}`, method: 'GET', params: { fields: 'id,name,fan_count' } }, 'pages_show_list');
    // `tasks` diz o que ESTE token pode fazer NA PÁGINA. Sem CREATE_CONTENT ali,
    // publicar não funciona nem com a permissão aprovada — é papel na página,
    // não escopo do app, e os dois são confundidos o tempo todo.
    //
    // SAI DE `/me/accounts`, e não de `/{page_id}`: pedir `fields=tasks` na
    // página devolve `(#100) nonexisting field (tasks)`, que a primeira versão
    // desta sonda mostrou como se fosse falta de permissão. Sonda que acusa o
    // que não existe é pior que sonda nenhuma — ensina a ignorá-la.
    const t = await tentar('o que o token pode fazer NA PÁGINA (tasks)',
      { accountId: acct, path: '/me/accounts', method: 'GET', params: { fields: 'id,name,tasks', limit: 50 } },
      'pages_show_list');
    const paginas = (t.d && t.d.data) || [];
    const minha = paginas.find((pg) => String(pg.id) === String(marca.pageId));
    if (!paginas.length) console.log('      (o token não devolveu página nenhuma)');
    else if (!minha) console.log(`      ⚠ a página ${marca.pageId} NÃO está entre as ${paginas.length} que o token enxerga`);
    else {
      const tarefas = minha.tasks || [];
      console.log(`      tasks: ${tarefas.join(', ') || '(vazio)'}`);
      linha(tarefas.includes('CREATE_CONTENT'), '      CREATE_CONTENT — sem isto, publicar na página não funciona nem com a permissão aprovada');
    }
  }

  if (marca.igId) {
    await tentar('ler o perfil do Instagram', { accountId: acct, path: `/${marca.igId}`, method: 'GET', params: { fields: 'id,username,followers_count' } }, 'instagram_basic');
    await tentar('ler insights do Instagram', { accountId: acct, path: `/${marca.igId}/insights`, method: 'GET', params: { metric: 'reach', period: 'day', metric_type: 'total_value' } }, 'instagram_manage_insights');
    // O TESTE HONESTO DE "POSSO PUBLICAR?": exige a mesma permissão da
    // publicação e NÃO publica nada. Criar um contêiner de mídia também
    // provaria, mas escreveria de verdade na conta do dono — e um contêiner
    // esquecido vira post publicado por engano no clique errado.
    const lim = await tentar('quota de publicação do Instagram (posso publicar?)', { accountId: acct, path: `/${marca.igId}/content_publishing_limit`, method: 'GET', params: { fields: 'config,quota_usage' } }, 'instagram_content_publish');
    const q = lim.d && lim.d.data && lim.d.data[0];
    if (q) console.log(`      quota: ${q.quota_usage ?? '?'} de ${(q.config && q.config.quota_total) ?? '?'} posts nas últimas 24h`);
  }

  // ── 4. O VEREDITO ────────────────────────────────────────────────────────
  console.log('\n── 4. Veredito');
  const faltamEscopo = PRECISA.filter(([k]) => !concedidas.has(k));
  const falharam = provas.filter((p) => !p.ok);
  if (!faltamEscopo.length && !falharam.length) {
    console.log('   O token tem tudo e todos os endpoints respondem.');
    console.log('   Isto NÃO quer dizer que o App Review está feito: se o app está em');
    console.log('   DESENVOLVIMENTO, isto vale só para quem é admin do app. O que decide');
    console.log('   para os outros é o nível de acesso no painel.');
  } else {
    if (faltamEscopo.length) console.log(`   escopos que o token NÃO tem: ${faltamEscopo.map(([k]) => k).join(', ')}`);
    if (falharam.length) console.log(`   endpoints que recusaram: ${falharam.map((p) => p.nome).join(' · ')}`);
    console.log('   → estes são os que precisam entrar no pedido de App Review.');
  }
}
main().catch((e) => { console.error('FATAL:', (e && e.message) || e); process.exit(1); });
