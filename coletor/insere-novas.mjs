// Marcas novas no Observatório: Isla (loja VTEX real + leitura + editorial), Luiza Barcelos e Victor Hugo
// (leitura de desenvolvimento + editorial da pesquisa; galeria de produto virá por browser depois).
// L'Occitane é só Marketing → entra apenas via ig-coletor.
import fs from 'fs';
import { coletarLoja } from './lojas.mjs';

const env = {};
for (const l of fs.readFileSync(new URL('./.env', import.meta.url), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const URL_SB = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_KEY;
const RODADA = '2026-06-23';
const sbH = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
async function rest(method, path, body) {
  const r = await fetch(URL_SB + '/rest/v1/' + path, { method, headers: { ...sbH, Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); if (!r.ok) throw new Error(method + ' ' + path + ' → ' + r.status + ' ' + t.slice(0, 200)); return t ? JSON.parse(t) : null;
}
async function ogImage(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) });
    const h = await r.text();
    const m = h.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) || h.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const u = m && m[1]; return (u && /^https?:\/\//.test(u) && !/logo/i.test(u)) ? u : null;
  } catch (e) { return null; }
}

const base = { url: null, fonte: 'RBV · Observatório', data_publicacao: RODADA, rodada: RODADA, destaque: false, imagem_url: null, produtos: null };
const rows = [];

// ───────────────── ISLA (loja VTEX real) ─────────────────
const isla = await coletarLoja('Isla');
const islaBest = (isla && isla.bestsellers) || [];
const islaNov = (isla && isla.novidades) || [];
const islaImg = islaBest[0] && islaBest[0].img;
if (islaBest.length) rows.push({ ...base, marca: 'Isla', categoria: 'Best-seller', titulo: 'Mais vendidas — bolsas', fonte: 'Loja oficial · islaoficial.com.br', imagem_url: islaImg, produtos: islaBest });
if (islaNov.length) rows.push({ ...base, marca: 'Isla', categoria: 'Lançamento', titulo: 'Novidades — chegou agora', fonte: 'Loja oficial · islaoficial.com.br', imagem_url: islaNov[0].img, produtos: islaNov });
rows.push({ ...base, marca: 'Isla', categoria: 'Desenvolvimento', destaque: true, imagem_url: islaImg,
  titulo: 'Bolsa-joia: o desejo está no brilho, não no shape',
  url: 'https://www.islaoficial.com.br/bolsas',
  resumo: `A Isla desenvolve numa categoria que quase ninguém do painel ocupa: a **bolsa-joia**. O valor não está no formato (clutch, pouch, crossbody comuns), mas no **acabamento ornamental** — paetês, cristais, ráfia, crochê, bordado e croco. Preço cheio na faixa de **R$800 a R$1.500** (campeãs vão de pouch de paetê a carteira croco "Forever New" R$1.299), com **descontos agressivos** de coleção passada (até 70% off). Linhas nomeadas (Geórgia, Maxi Esfera Arché, Forever New) e collab com a **PatBO** posicionam a marca como autoral/festa. **Leitura p/ Vessel:** é o oposto da bolsa utilitária — aqui o produto é objeto de ocasião e o ornamento é o argumento. Mostra que **textura/aplicação pode valer mais que shape**, e que há um nicho de "bolsa de festa acessível" pouco disputado.` });
rows.push({ ...base, marca: 'Isla', categoria: 'Campanha', destaque: true,
  titulo: 'Isla x PatBO e os 15 anos: a aposta no autoral e no afetivo',
  resumo: `A Isla celebrou **15 anos** (2025/26) com a 2ª edição do "Isla Fashion Trip" e firmou uma **colaboração com a PatBO** — bolsas-joia de formas estruturadas com as estampas da grife, vendidas inclusive no site da parceira. Em paralelo, entrou na onda de **circularidade** virando ponto de coleta da Gringa (recommerce de luxo). O norte de marca é **exclusividade autoral + sustentabilidade**, mirando a cliente que quer peça de ocasião com assinatura. **Leitura p/ Vessel:** a Isla constrói desejo por **edição limitada e collab**, não por volume — tática de marca pequena que cria escassez percebida.` });

// ───────────────── LUIZA BARCELOS ─────────────────
const lbImg = await ogImage('https://www.luizabarcelos.com.br/categoria/bolsas');
rows.push({ ...base, marca: 'Luiza Barcelos', categoria: 'Desenvolvimento', destaque: true, imagem_url: lbImg,
  titulo: 'Couro premium-acessível: o meio-termo bem resolvido',
  url: 'https://www.luizabarcelos.com.br/categoria/bolsas',
  resumo: `Fundada em **1989** (Nova Serrana/MG), a Luiza Barcelos desenvolve bolsa de **couro de qualidade** numa faixa **premium-acessível (~R$660 a R$1.800)** — tiracolo, tote, ombro, shopping, matelassê. Ex.: tiracolo matelassê couro R$1.199,90; tote/shopping couro até R$1.799,90. É o **degrau imediatamente acima da Vessel/Santa Lolla**: couro de verdade num ticket que ainda não é o premium puro (Arezzo/Schutz). Estética sofisticada e feminina, "feminilidade com um toque de arte". **Leitura p/ Vessel:** ocupa exatamente a faixa de ascensão que o cliente da Vessel almeja — couro acessível bem-acabado. É concorrente de **aspiração próxima**, mais perigosa que o luxo distante.` });
rows.push({ ...base, marca: 'Luiza Barcelos', categoria: 'Campanha', destaque: true,
  titulo: 'Campanha "Instinto": conteúdo editorial além do anúncio',
  resumo: `A campanha de Verão **"Instinto"** trabalha autoconhecimento e intuição como força feminina, com ativações que vão muito além do anúncio: **revista digital, landing page interativa e videocasts** com convidadas. Soma-se à coleção **"Viva"** e a um **app próprio**. O norte é transformar a marca em **plataforma de conteúdo e comunidade**, não só vitrine. **Leitura p/ Vessel:** a LB investe em **conteúdo proprietário** (revista, podcast) para criar relação — caro de copiar, mas mostra a direção de "marca-mídia" que diferencia no premium-acessível.` });
rows.push({ ...base, marca: 'Luiza Barcelos', categoria: 'Expansão',
  titulo: 'Mais de 60 lojas, 850 multimarcas e app: a máquina de capilaridade',
  resumo: `O Grupo Luiza Barcelos opera **+60 lojas próprias e franquias** (Brasil e Bolívia) e presença em **+850 multimarcas**, com inauguração recente no **Brasília Shopping** (fluxo +29%, segundo a CEO Juliana Rossi Prates Beltrão) e **app próprio** lançado. É expansão física + digital simultânea. **Leitura p/ Vessel:** marca em **forte capilaridade** — provável aumento de presença em shoppings/multimarcas no entorno. Monitorar pontos físicos.` });

// ───────────────── VICTOR HUGO ─────────────────
const vhImg = await ogImage('https://www.victorhugo.com.br/search?collection=bolsas') || await ogImage('https://www.victorhugo.com.br/');
rows.push({ ...base, marca: 'Victor Hugo', categoria: 'Desenvolvimento', destaque: true, imagem_url: vhImg,
  titulo: 'Couro de luxo e a linha-ícone Volpa: o topo absoluto do painel',
  url: 'https://www.victorhugo.com.br/search?collection=bolsas',
  resumo: `A Victor Hugo desenvolve no **teto de preço de todo o painel**: bolsas de **couro de R$2.600 a R$6.600** (ex.: Volpa Duca Small ~R$3.748; linha capitonê R$2.975–6.598), ancoradas na herança de **50 anos** de artigos de couro. A assinatura é a **linha Volpa** e o padrão **capitonê** — couro, clássico, atemporal, lógica de "casa de couro" tradicional. É a marca mais cara e mais "old money" do recorte. **Leitura p/ Vessel:** não é concorrente de bolso (3–10× o ticket), mas é a **régua máxima de luxo em couro nacional** — útil como âncora de comparação ("o couro Victor Hugo custa 5–10×") e como referência de acabamento aspiracional.` });
rows.push({ ...base, marca: 'Victor Hugo', categoria: 'Faturamento', destaque: true,
  titulo: 'Pedido de falência de R$1,2 bilhão: o gigante do couro em crise',
  url: 'https://www.victorhugo.com.br/',
  resumo: `Manchete comercial de peso: em **fevereiro de 2026**, a Justiça do Rio abriu **processo de falência contra o grupo Victor Hugo**, com dívidas de **~R$1,2 bilhão** (~R$900 mi à União + ~R$355 mi ao Estado do RJ). A Justiça autorizou as lojas a **seguir operando sob nova gestão** para preservar empregos enquanto o caso tramita. **Leitura p/ Vessel:** uma marca-ícone de luxo em **fragilidade financeira** tende a abrir espaço — possível retração de pontos, queima de estoque e clientes premium "órfãos" buscando alternativas. Vale acompanhar de perto: crise de concorrente forte é janela de oportunidade.` });
rows.push({ ...base, marca: 'Victor Hugo', categoria: 'Estratégia',
  titulo: '50 anos e novo conceito de loja — herança como ativo',
  resumo: `Apesar da crise, a marca celebrou os **50 anos** com coleção comemorativa e **reinaugurou lojas com novo conceito arquitetônico** (assinatura de Francisco Telles, ex.: Flamboyant/Goiânia; nova unidade em Brasília/Iguatemi). Migrou também o e-commerce para um stack moderno (Next.js/Vercel). O norte declarado é **reafirmar a herança e o pedigree de couro**. **Leitura p/ Vessel:** mesmo sob pressão, a VH aposta na **história como diferencial** — lembrete de que tradição é ativo, mas não substitui saúde financeira.` });

// ───────────────── grava ─────────────────
const marcasNovas = ['Isla', 'Luiza Barcelos', 'Victor Hugo'];
const catsProd = ['Best-seller', 'Lançamento', 'Desenvolvimento', 'Campanha', 'Estratégia', 'Expansão', 'Faturamento'];
for (const m of marcasNovas) for (const c of catsProd) {
  await rest('DELETE', `noticias_concorrentes?marca=eq.${encodeURIComponent(m)}&rodada=eq.${RODADA}&categoria=eq.${encodeURIComponent(c)}`);
}
let ok = 0;
try { ok = (await rest('POST', 'noticias_concorrentes', rows)).length; }
catch (e) {
  console.log('bulk falhou, 1 a 1:', String(e).slice(0, 140));
  for (const row of rows) { try { await rest('POST', 'noticias_concorrentes', [row]); ok++; } catch (e2) { console.log('FALHOU', row.marca, row.categoria, String(e2).slice(0, 160)); } }
}
console.log(`Isla loja: ${islaBest.length} best + ${islaNov.length} nov. LB og:${lbImg ? 'ok' : 'no'} VH og:${vhImg ? 'ok' : 'no'}.`);
console.log(`Inseridas ${ok}/${rows.length} linhas das marcas novas.`);
