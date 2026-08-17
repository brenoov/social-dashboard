// EM QUE BALDE cada campanha entra, na seção 02 do painel de Redes Sociais.
//
// A decisão sai do sinal que a META AFIRMA no conjunto (destination_type e
// optimization_goal) — NUNCA do nome da campanha. Nomear por convenção
// ("| PERFIL", "[+ SEGUIDORES]") funciona hoje nestas contas e quebra no primeiro
// dia em que alguém nomear diferente.
//
// POR QUE NÃO DÁ PRA USAR SÓ O OBJETIVO (medido em 17/08/2026, produção):
//   - Vessel: R$ 5.699 dos R$ 6.553 com objetivo "Engajamento" são WhatsApp.
//     Somando cru, o custo por seguidor de lá ficaria ~8x mais caro do que é.
//   - Breno Vale: os R$ 2.584 de "Tráfego" vão para o PERFIL — são de seguidor
//     da cabeça aos pés. Um recorte "só engajamento" deixaria a conta zerada.
//
// POR QUE ESTE MÓDULO EXISTE, se a Gestão de Tráfego já tem baldes.js: lá,
// tráfego-para-o-perfil e tráfego-para-o-site caem os dois em 'trafego', e é
// justamente essa divisão que dá sentido ao balde Seguidores. Mexer aqui não
// pode mudar o veredito da régua de lá — por isso o mapa novo mora à parte, e
// só o que é comum vem importado.
// PURO: sem rede, sem tela.
import { ehDeWhatsapp, baldeDoObjetivo } from '../gestao-trafego/baldes.js';

export const BALDES = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'seguidores', rotulo: 'Seguidores' },
  { id: 'contatos', rotulo: 'Contatos' },
  { id: 'site', rotulo: 'Site e alcance' },
  { id: 'vendas', rotulo: 'Vendas' },
];

export function rotuloDoBalde(id) {
  const b = BALDES.find(x => x.id === id);
  return b ? b.rotulo : 'Todos';
}

const NORM = v => String(v || '').toUpperCase();

// Destinos que são CONVERSA. MESSAGING_* cobre as combinações que a Meta foi
// criando (MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP e parentes).
function ehConversa(conjuntos) {
  if (ehDeWhatsapp(conjuntos)) return true;
  return (conjuntos || []).some((s) => {
    const d = NORM(s && s.destination_type);
    return d === 'INSTAGRAM_DIRECT' || d === 'MESSENGER' || d.startsWith('MESSAGING_');
  });
}

function algumConjunto(conjuntos, teste) {
  return (conjuntos || []).some(s => teste(NORM(s && s.destination_type), NORM(s && s.optimization_goal)));
}

// A ordem aqui É a regra. A primeira que casar vence — ver a tabela do desenho.
//
// OS DESTINOS SÃO OS QUE A META DEVOLVEU DE VERDADE, não os que eu imaginei. A
// coleta de 17/08/2026 (299 conjuntos, 5 contas) trouxe dez: INSTAGRAM_PROFILE,
// INSTAGRAM_PROFILE_AND_FACEBOOK_PAGE, INSTAGRAM_DIRECT,
// MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP, WHATSAPP, ON_POST, ON_VIDEO,
// ON_AD, WEBSITE, WEBSITE_AND_PHONE_CALL — e UNDEFINED.
export function baldeDaCampanha(campanha) {
  const c = campanha || {};
  const conjuntos = Array.isArray(c.conjuntos) ? c.conjuntos : [];
  const objetivo = baldeDoObjetivo(c.objective);

  if (ehConversa(conjuntos)) return 'contatos';            // 1 — conversa vence tudo
  if (objetivo === 'leads') return 'contatos';             // 2 — cadastro
  // 3 — PERFIL. Prefixo, não igualdade: a Meta também devolve
  // INSTAGRAM_PROFILE_AND_FACEBOOK_PAGE, e com `===` essa campanha caía no
  // objetivo e terminava em 'site' — o erro exato que este módulo elimina.
  // Vem DEPOIS da regra 1 de propósito: INSTAGRAM_DIRECT não é perfil, é conversa.
  if (algumConjunto(conjuntos, (d, o) => d.startsWith('INSTAGRAM_PROFILE') || o === 'PROFILE_VISIT')) return 'seguidores';
  // 4 — engajamento na peça. ON_AD é o terceiro lugar onde a Meta põe isso.
  if (algumConjunto(conjuntos, (d, o) => d === 'ON_POST' || d === 'ON_VIDEO' || d === 'ON_AD' || o === 'POST_ENGAGEMENT' || o === 'THRUPLAY')) return 'seguidores';
  if (objetivo === 'vendas') return 'vendas';              // 5
  if (objetivo === 'mensagens') return 'contatos';         // objetivo antigo MESSAGES
  // 6 — SITE declarado no conjunto. Mandar gente para FORA do Instagram não é
  // campanha de seguidor, mesmo com objetivo de engajamento.
  //
  // Entra aqui, e não antes da regra 5, porque quase toda campanha de VENDA
  // aponta para o site: subir esta regra esvaziaria o balde de Vendas.
  if (algumConjunto(conjuntos, (d) => d === 'WEBSITE' || d === 'WEBSITE_AND_PHONE_CALL')) return 'site';
  if (objetivo === 'engajamento') return 'seguidores';     // sem conjunto: engajamento é do perfil
  // 7 — tráfego, cliques, reconhecimento, desconhecido. UNDEFINED cai aqui de
  // propósito: é a Meta dizendo que não sabe, e inventar um balde a partir disso
  // seria responder errado com confiança.
  return 'site';
}

export function idsDoBalde(campanhas, balde) {
  const lista = campanhas || [];
  if (balde === 'todos' || !balde) return lista.map(c => String(c.campaign_id));
  return lista.filter(c => baldeDaCampanha(c) === balde).map(c => String(c.campaign_id));
}

// O balde recorta o TIPO; o "⚙ Filtrar campanhas" recorta DENTRO dele. Os dois se
// somam.
//
// `selecionadas` segue a régua que já existe no painel: null = todas as campanhas,
// [] = NENHUMA (escolha do dono, não ausência de escolha).
export function idsParaConsulta(campanhas, balde, selecionadas) {
  const doBalde = idsDoBalde(campanhas, balde);
  if (selecionadas == null) return doBalde;
  const marcadas = new Set(selecionadas.map(String));
  return doBalde.filter(id => marcadas.has(id));
}

// SÓ A ÚLTIMA COLETA DE CONJUNTOS VOTA.
//
// campaign_adsets nunca encolhe: o coletor grava o que a Meta devolve e não apaga
// o que sumiu de lá. Sem esta peneira, um conjunto de WhatsApp desligado há meses
// continuaria classificando a campanha como Contatos para sempre — e o dinheiro
// dela nunca mais voltaria ao balde certo.
//
// A régua é o MAIOR `synced_at` que está DENTRO do próprio dado, nunca a data de
// hoje: se a coleta falhar por alguns dias, o maior é simplesmente a última rodada
// boa e nada se perde. Linha sem `synced_at` cai fora — ela não tem como provar
// que é a mais recente. Se TODAS caírem, a tela usa o mesmo caminho de quando a
// tabela está vazia: cada campanha classificada pelo objetivo. Ninguém some.
//
// Comparação por texto de propósito: `synced_at` chega do PostgREST como data ISO
// ('2026-08-17'), e ISO ordena igual em texto e no calendário.
export function conjuntosMaisRecentes(linhas) {
  const lista = Array.isArray(linhas) ? linhas.filter(l => l && l.synced_at) : [];
  if (lista.length === 0) return [];
  const maior = lista.reduce((m, l) => (String(l.synced_at) > m ? String(l.synced_at) : m), '');
  return lista.filter(l => String(l.synced_at) === maior);
}

// QUAIS BALDES NÃO TÊM DINHEIRO na janela — os que a barra apaga.
//
// `idsPorBalde` = { seguidores: [ids], contatos: [ids], … } já com o filtro
// manual aplicado. `linhasDeGasto` = o gasto DIÁRIO por campanha da janela.
//
// SÉRIE DIÁRIA VAZIA NÃO É "NINGUÉM GASTOU". A conta sai do gasto por dia
// (period_days=0), mas os cartões leem o agregado de 7/30 dias, e as duas fatias
// não têm o mesmo frescor: em 17/08/2026 o último dia solto do Breno Vale e da
// Raíssa era 09/08, fora da janela padrão de 7D (10/08..16/08). Sem esta guarda a
// barra apagava os quatro botões e afirmava que ninguém tinha gastado, enquanto
// essas contas gastaram R$ 80,41 e R$ 297,21 exatamente ali. Sem medida, não se
// afirma nada: devolve lista vazia e todos os botões continuam clicáveis.
export function baldesSemGasto(idsPorBalde, linhasDeGasto) {
  const mapa = idsPorBalde || {};
  const linhas = Array.isArray(linhasDeGasto) ? linhasDeGasto : [];
  if (linhas.length === 0) return [];
  const baldeDoId = {};
  const gasto = {};
  Object.keys(mapa).forEach((b) => {
    gasto[b] = 0;
    (mapa[b] || []).forEach((id) => { baldeDoId[String(id)] = b; });
  });
  linhas.forEach((l) => {
    const b = baldeDoId[String(l && l.campaign_id)];
    if (b) gasto[b] += (parseFloat(l && l.spend) || 0);
  });
  return Object.keys(mapa).filter(b => !(gasto[b] > 0));
}

// EM QUE BALDE A TELA REALMENTE ENTRA. O escolhido pode não existir neste perfil
// (a Motoeasy não tem campanha de seguidores) ou não ter rodado neste período;
// nesse caso a tela cai em Todos, em vez de mostrar R$ 0 como se fosse resposta.
//
// Repare que ele NÃO devolve uma escolha nova para gravar: quem escolheu continua
// tendo escolhido. Voltar a um perfil que tem aquele balde devolve a pessoa onde
// ela estava — é isso que segura o modo vitrine, que troca de perfil sozinho.
export function baldeEfetivo(escolhido, vazios) {
  if (!escolhido) return 'todos';
  return (vazios || []).includes(escolhido) ? 'todos' : escolhido;
}
