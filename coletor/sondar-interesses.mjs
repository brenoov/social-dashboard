// SONDA DO CATÁLOGO DA META — o que existe, e sob que nome.
//
// POR QUE ELA EXISTE: a rodada seca de 2026-07-31 mostrou 28 dos 48 termos da
// IA voltando VAZIOS da Meta — inclusive `bolsas femininas`, que é o produto
// principal da loja, em todos os seis objetivos. Sem saber sob QUE NOME a Meta
// guarda bolsa, cinto e carteira (se é que guarda), qualquer mexida no pedido à
// IA é chute — e chute no pedido já zerou uma rodada inteira antes (a instrução
// de "termos específicos", commit cef4b36).
//
// CUSTA R$ 0: não chama IA nenhuma. É só a busca da Meta, a MESMA que o robô e a
// Fábrica usam (type=adinterest). Por isso o passo dela no workflow não recebe
// a ANTHROPIC_API_KEY: o que não é usado não é entregue.
//
// SEM TETO E SEM PISO de propósito: aqui se está perguntando o que EXISTE, não
// escolhendo o que serve. Filtrar a sonda esconderia justamente a informação que
// ela foi buscar. Quem filtra é o robô, depois, com TETO_DE_PUBLICO e
// PISO_DE_PUBLICO.
//
// NÃO GRAVA NADA. É diagnóstico: entra, pergunta, imprime e sai.
import { colherDaBusca, linhasDaPrevia } from './lib/interesses.mjs';
import { loginServico } from './lib/bling-comercial.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kounqtdoioootxqegkij.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ANON = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvdW5xdGRvaW9vb3R4cWVna2lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMDMwMDUsImV4cCI6MjA5NDc3OTAwNX0.MVXa6jngjKXkH3eZ7as_j_k8Eb7lJKcFmO4kCKAnuHM';
const REST = SUPABASE_URL + '/rest/v1';
const PAUSA_ENTRE_BUSCAS = 350;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// OS TERMOS A SONDAR, agrupados pelo ESTOQUE REAL da loja (gc_estoque_item):
// Cinto 398 · Outros acessórios 200 · Transversal 180 · Bolsa de ombro 162 ·
// Óculos 139 · Carteira 53 · Tote 52 · Bolsa de mão 49 · Clutch 45 · Mochila 16.
//
// Cada grupo vai do mais CURTO ao mais DESCRITIVO de propósito: a rodada mostrou
// que sobrevive o termo curto e canônico (`acessórios moda` → "Acessórios de
// moda", `guarda-roupa` → "Guarda-roupas") e morre a frase descritiva. Sondar os
// dois lados do mesmo produto é o que transforma isso de impressão em regra.
//
// Os três últimos grupos são CONTROLE, não produto: se marca famosa e palavra
// solta acharem coisa enquanto o produto da loja não acha nada, a conclusão
// muda — o problema deixa de ser "como se escreve" e passa a ser "a Meta não
// tem essa categoria".
const TERMOS = [
  // Cinto — a MAIOR categoria do estoque, e a que a IA quase nunca pede.
  'cinto', 'cintos', 'cinto feminino', 'cinto de couro',
  // Bolsa — o produto que a loja mais anuncia, e que voltou VAZIO em 6/6.
  'bolsa', 'bolsas', 'bolsa feminina', 'bolsas femininas',
  'bolsa de couro', 'bolsa transversal', 'bolsa de ombro', 'clutch', 'mochila',
  // Carteira e porta-cartões.
  'carteira', 'carteiras', 'carteira feminina', 'porta-cartões',
  // Óculos — este a IA já pediu e FUNCIONOU; serve de gabarito do que dá certo.
  'óculos', 'óculos de sol', 'óculos escuros',
  // Acessório — o guarda-chuva que o teto antigo derrubava.
  'acessórios', 'acessórios de moda', 'acessórios femininos',
  // CONTROLE 1: palavra solta, larga, que certamente existe.
  'moda', 'luxo', 'presente',
  // CONTROLE 2: marca concorrente conhecida (a Meta costuma ter marca grande).
  'Arezzo', 'Schutz',
  // CONTROLE 3: inglês, pra ver se o catálogo brasileiro é mais pobre que o de fora.
  'handbag', 'handbags', 'leather bag',
];

async function buscarNaMeta(accountId, termo, token) {
  const r = await fetch(SUPABASE_URL + '/functions/v1/meta-proxy', {
    method: 'POST',
    headers: { apikey: ANON, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId,
      path: '/search',
      params: { type: 'adinterest', q: termo, limit: 10 },
      method: 'GET',
    }),
  });
  if (!r.ok) throw new Error('meta-proxy ' + r.status);
  return r.json();
}

// SONDA DOS "PARECIDOS" — o `adinterestsuggestion` da Meta.
//
// POR QUE ANTES DE CONSTRUIR: a ideia é oferecer "mostrar parecidos" no editor de
// público, a partir de um interesse que a pessoa já escolheu. Só que a doc da
// Meta já errou duas vezes neste projeto (sobre `audience_size` e sobre
// `locale`), e a regra que ficou é: formato de API externa afirmado "segundo a
// documentação" e não verificado ao vivo é suposição vestida de restrição.
//
// Custa R$ 0 e responde três coisas de uma vez: o endpoint existe nesta conta,
// devolve nomes de verdade, e devolve tamanho de público (sem tamanho, o piso e
// o teto não teriam como julgar o que voltasse).
//
// `interest_list` vai como ARRAY: o meta-proxy faz JSON.stringify em valor que é
// objeto, então converter aqui converteria duas vezes — mesma pegadinha do
// `cities` na tradução de geolocalização.
async function sugerirParecidos(accountId, nomes, token) {
  const r = await fetch(SUPABASE_URL + '/functions/v1/meta-proxy', {
    method: 'POST',
    headers: { apikey: ANON, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId,
      path: '/search',
      params: { type: 'adinterestsuggestion', interest_list: nomes, limit: 10 },
      method: 'GET',
    }),
  });
  if (!r.ok) throw new Error('meta-proxy ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}

async function run() {
  if (!SERVICE_KEY) throw new Error('falta SUPABASE_SERVICE_KEY');
  const token = await loginServico();
  const contas = await fetch(REST + '/fabrica_marcas?select=nome,account_id&ativo=eq.true', {
    headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY },
  }).then((r) => r.json());
  const conta = (contas || []).find((c) => c && c.account_id);
  if (!conta) throw new Error('nenhuma marca ativa com account_id — sem conta não há busca');
  console.log(`SONDA do catálogo da Meta · conta de ${conta.nome} · ${TERMOS.length} termos · sem IA, custo R$ 0\n`);

  let acharam = 0;
  const vazios = [];
  for (const termo of TERMOS) {
    let resposta = null;
    try {
      resposta = await buscarNaMeta(conta.account_id, termo, token);
    } catch (e) {
      // Busca que falha NÃO é busca vazia, e misturar as duas coisas estragaria
      // a conta do fim — que é justamente o número que esta sonda existe pra dar.
      console.log(`  "${termo}" → ⚠ a busca falhou (${String(e).slice(0, 80)})`);
      await sleep(PAUSA_ENTRE_BUSCAS);
      continue;
    }
    // Sem teto, sem piso e sem limite: aqui se pergunta o que EXISTE.
    const { itens } = colherDaBusca([termo], [resposta], Infinity, Infinity, -Infinity);
    if (!itens.length) { vazios.push(termo); console.log(`  "${termo}" → nada`); }
    else {
      acharam++;
      console.log(`  "${termo}" → ${itens.length} achados`);
      for (const linha of linhasDaPrevia(itens)) console.log(linha);
    }
    await sleep(PAUSA_ENTRE_BUSCAS);
  }

  // ── OS "PARECIDOS" ────────────────────────────────────────────────────────
  // Roda no fim porque é uma pergunta diferente: não é "este termo existe?", é
  // "a Meta sabe sugerir a partir do que já existe?". Falha aqui NÃO derruba a
  // sonda — a resposta "o endpoint não serve nesta conta" é resultado, e é
  // exatamente por isso que se sonda antes de construir.
  console.log('\n── Parecidos (adinterestsuggestion) ──');
  for (const semente of [['Bolsas'], ['Cinto'], ['Bolsas', 'Carteira']]) {
    try {
      const resp = await sugerirParecidos(conta.account_id, semente, token);
      const { itens } = colherDaBusca(semente, [resp], Infinity, Infinity, -Infinity);
      if (!itens.length) { console.log(`  a partir de [${semente.join(', ')}] → nada`); }
      else {
        console.log(`  a partir de [${semente.join(', ')}] → ${itens.length} parecidos`);
        for (const linha of linhasDaPrevia(itens)) console.log(linha);
      }
    } catch (e) {
      console.log(`  a partir de [${semente.join(', ')}] → ⚠ ${String(e).slice(0, 160)}`);
    }
    await sleep(PAUSA_ENTRE_BUSCAS);
  }

  console.log(`\nSONDA: ${acharam} termos acharam algo, ${vazios.length} voltaram vazios.`);
  if (vazios.length) console.log(`Vazios: ${vazios.join(' · ')}`);
  // TODOS vazios = não é o vocabulário, é o token ou a conta. Vermelho, como a
  // rodada do robô: sonda que não achou NADA e termina verde vira "medimos e o
  // catálogo não tem" — a conclusão errada mais cara que este projeto já pagou.
  if (!acharam) { console.error('NENHUM termo achou nada — isso é falha de acesso, não resposta do catálogo.'); process.exit(1); }
}

run().catch((e) => { console.error(String(e && e.stack || e)); process.exit(1); });
