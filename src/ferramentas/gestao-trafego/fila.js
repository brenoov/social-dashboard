// A FILA DE APROVAÇÃO: o que o robô propôs e ainda espera uma decisão do dono.
//
// POR QUE ELA EXISTE: até aqui a sugestão da IA vinha com um botão no próprio
// cartão da campanha que mexia no orçamento na hora. Com a fila, mexer em
// dinheiro passa a ter UM caminho só, com registro de quem decidiu e quando —
// e o cartão volta a ser só a leitura da campanha.
//
// PURO: sem rede, sem tela, sem relógio próprio (o `agora` entra por parâmetro,
// senão não dá pra testar o silêncio de 7 dias sem esperar 7 dias).

// Quanto tempo uma recusa cala aquela campanha. Decisão do dono (2026-07-29):
// recusar não pode virar "não me mostre nunca mais" — a situação muda —, mas
// também não pode reaparecer no dia seguinte, senão a fila repete todo dia o
// que ele já respondeu.
export const DIAS_DE_SILENCIO = 7;

const ms = (dias) => dias * 24 * 60 * 60 * 1000;
const quando = (v) => { const d = v ? new Date(v) : null; return (d && !isNaN(d)) ? d.getTime() : null; };

// "Manter" não é ação: não há nada pra aprovar num conselho de não mexer. Deixar
// esses itens na fila encheria a lista de decisões que não existem — das 38
// análises guardadas em 29/07, 12 eram 'manter'.
export function pedeAcao(analise) {
  const v = analise && analise.veredito;
  return v === 'escalar' || v === 'reduzir' || v === 'pausar';
}

// Reparte um total novo entre os conjuntos ATIVOS, mantendo a proporção que o
// dono já escolheu entre eles: quem tinha o dobro continua com o dobro.
//
// Os centavos que sobram do arredondamento vão pros MAIORES RESTOS (método do
// maior resto). Sem isso, arredondar cada parte por conta própria faz a soma
// não bater com o total aprovado — no caso real da "MODA & BOLSAS" (R$ 230 →
// R$ 280 em 4 conjuntos) a diferença aparece já na primeira conta. Aprovar
// R$ 280 e aplicar R$ 279,98 é uma promessa quebrada em silêncio.
//
// → [{ ...conjunto, deCentavos, paraCentavos }] — a soma dos `paraCentavos` é
//   EXATAMENTE `totalNovoCentavos`. Devolve [] quando não dá pra repartir.
export function distribuirEntreConjuntos(conjuntos, totalNovoCentavos) {
  const lista = (conjuntos || []).filter((c) => c && Number(c.deCentavos) > 0);
  const total = Number(totalNovoCentavos);
  if (!lista.length || !Number.isFinite(total) || total <= 0) return [];
  const soma = lista.reduce((t, c) => t + Number(c.deCentavos), 0);
  if (soma <= 0) return [];

  const partes = lista.map((c) => {
    const exato = (Number(c.deCentavos) / soma) * total;
    const piso = Math.floor(exato);
    return { ...c, paraCentavos: piso, _resto: exato - piso };
  });
  let sobra = total - partes.reduce((t, p) => t + p.paraCentavos, 0);
  // Maior resto primeiro; empate desempata pelo maior orçamento atual, pra que
  // a mesma entrada devolva sempre a mesma saída (nada de ordem instável).
  const ordem = [...partes].sort((a, b) => (b._resto - a._resto) || (b.deCentavos - a.deCentavos));
  for (let i = 0; sobra > 0; i = (i + 1) % ordem.length) { ordem[i].paraCentavos += 1; sobra -= 1; }
  return partes.map(({ _resto, ...p }) => p);
}

// Esta análise já foi respondida? A decisão vale para a análise que existia
// QUANDO ela foi tomada: se o robô gerou uma análise NOVA depois, é outro
// contexto e a pergunta volta a valer.
function jaRespondida(analise, decisao) {
  if (!decisao) return false;
  const decidido = quando(decisao.decidido_em);
  const gerado = quando(analise.gerado_em);
  if (decidido == null) return false;
  if (gerado == null) return true;   // sem saber quando a análise nasceu, a decisão prevalece
  return decidido >= gerado;
}

// Uma recusa cala a campanha por DIAS_DE_SILENCIO — inclusive contra análises
// novas, que é o ponto: o robô regrava todo dia, e sem isso a recusa duraria
// até a próxima rodada, ou seja, algumas horas.
function estaSilenciada(decisao, agoraMs) {
  if (!decisao || decisao.decisao !== 'recusada') return false;
  const ate = quando(decisao.silenciar_ate);
  if (ate != null) return agoraMs < ate;
  const decidido = quando(decisao.decidido_em);
  return decidido != null && agoraMs < decidido + ms(DIAS_DE_SILENCIO);
}

// Análise vencida: passou do `valida_ate` que o próprio robô gravou. Acontece
// quando ele para de reanalisar uma campanha — em 29/07 havia três de 23 a 26
// dias. Não some da tela: vai pra um grupo à parte, porque campanha que o robô
// abandonou é justamente o que ninguém percebe faltando.
function estaVencida(analise, agoraMs) {
  const ate = quando(analise.valida_ate);
  return ate != null && agoraMs >= ate;
}

// Monta a fila a partir das análises do robô e das decisões já tomadas.
// `decisoes` é uma lista; vale a mais recente de cada campanha.
// → { pendentes, vencidas, silenciadas, respondidas } — as três últimas existem
//   pra tela poder CONTAR o que escondeu, em vez de sumir com tudo em silêncio.
export function montarFila(analises, decisoes, agora) {
  const agoraMs = quando(agora) ?? Date.now();
  const porCampanha = new Map();
  for (const d of decisoes || []) {
    if (!d || d.campaign_id == null) continue;
    const chave = String(d.campaign_id);
    const atual = porCampanha.get(chave);
    if (!atual || (quando(d.decidido_em) ?? 0) > (quando(atual.decidido_em) ?? 0)) porCampanha.set(chave, d);
  }

  const saida = { pendentes: [], vencidas: [], silenciadas: [], respondidas: [] };
  for (const a of analises || []) {
    if (!a || a.campaign_id == null || !pedeAcao(a)) continue;
    const d = porCampanha.get(String(a.campaign_id)) || null;
    const item = { ...a, decisao: d };
    // Ordem importa: o silêncio de uma recusa vale mesmo sobre análise nova, e
    // é por isso que ele é checado ANTES de "já respondida".
    if (estaSilenciada(d, agoraMs)) saida.silenciadas.push(item);
    else if (jaRespondida(a, d)) saida.respondidas.push(item);
    else if (estaVencida(a, agoraMs)) saida.vencidas.push(item);
    else saida.pendentes.push(item);
  }
  // Maior gasto primeiro: é onde a decisão do dono pesa mais dinheiro.
  const porValor = (x, y) => (Number(y.budget_atual_centavos) || 0) - (Number(x.budget_atual_centavos) || 0);
  saida.pendentes.sort(porValor);
  saida.vencidas.sort(porValor);
  return saida;
}

// Junta a leitura de SAÚDE às sugestões do robô (2026-07-29, pedido do dono:
// "não dá pra linkar também a saúde junto com as análises?").
//
// Faz duas coisas, e as duas importam:
//
// 1. ANEXA a saúde ao item que já existe. O caso que justifica o link é o robô
//    mandar ESCALAR uma campanha com a audiência queimada — aprovar ali é pagar
//    mais para repetir o anúncio para quem já cansou. `contradiz` marca isso.
//
// 2. CRIA item para campanha com alerta que o robô não trouxe. Sem isso o
//    alerta some: o robô disse 'manter', 'manter' não entra na fila, e uma
//    campanha com frequência 4,2× ficava invisível. É exatamente o caso da
//    "[Leads] Para WhatsApp" da Motoeasy medida em 29/07.
//
// `saudes` é uma lista de { campaign_id, account_id, campaign_name, conta_nome,
// saude, budget_atual_centavos }. Só 'alerta' vira item próprio — 'atencao' é
// observação e só aparece grudada numa sugestão que já existia. PURO.
export function mesclarSaude(fila, saudes) {
  const f = fila || {};
  const pendentes = [...(f.pendentes || [])];
  const porCampanha = new Map();
  for (const s of saudes || []) if (s && s.campaign_id != null) porCampanha.set(String(s.campaign_id), s);

  const jaNaFila = new Set(pendentes.concat(f.vencidas || [], f.silenciadas || [], f.respondidas || [])
    .map((i) => String(i.campaign_id)));

  for (const item of pendentes) {
    const s = porCampanha.get(String(item.campaign_id));
    if (s && s.saude) item.saude = s.saude;
  }

  const novos = [];
  for (const [id, s] of porCampanha) {
    if (jaNaFila.has(id)) continue;
    if (!s.saude || s.saude.nivel !== 'alerta') continue;
    novos.push({
      campaign_id: id,
      account_id: s.account_id || null,
      campaign_name: s.campaign_name || '',
      conta_nome: s.conta_nome || '',
      // O veredito vem da SAÚDE, e não há orçamento sugerido: ninguém calculou
      // um número aqui, e inventar um multiplicando o atual seria chutar.
      veredito: s.saude.veredito === 'pausar' ? 'pausar' : 'reduzir',
      justificativa: s.saude.porque,
      budget_atual_centavos: s.budget_atual_centavos ?? null,
      budget_sugerido_centavos: null,
      gerado_em: s.medido_em || null,
      origem: 'saude',
      saude: s.saude,
      conjuntos: s.conjuntos || [],
    });
  }
  const porValor = (x, y) => (Number(y.budget_atual_centavos) || 0) - (Number(x.budget_atual_centavos) || 0);
  return { ...f, pendentes: pendentes.concat(novos).sort(porValor) };
}

