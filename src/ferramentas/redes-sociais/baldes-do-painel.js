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
export function baldeDaCampanha(campanha) {
  const c = campanha || {};
  const conjuntos = Array.isArray(c.conjuntos) ? c.conjuntos : [];
  const objetivo = baldeDoObjetivo(c.objective);

  if (ehConversa(conjuntos)) return 'contatos';            // 1 — conversa vence tudo
  if (objetivo === 'leads') return 'contatos';             // 2 — cadastro
  if (algumConjunto(conjuntos, (d, o) => d === 'INSTAGRAM_PROFILE' || o === 'PROFILE_VISIT')) return 'seguidores'; // 3
  if (algumConjunto(conjuntos, (d, o) => d === 'ON_POST' || d === 'ON_VIDEO' || o === 'POST_ENGAGEMENT' || o === 'THRUPLAY')) return 'seguidores'; // 4
  if (objetivo === 'vendas') return 'vendas';              // 5
  if (objetivo === 'mensagens') return 'contatos';         // objetivo antigo MESSAGES
  if (objetivo === 'engajamento') return 'seguidores';     // sem conjunto: engajamento é do perfil
  return 'site';                                           // 6 — tráfego, cliques, reconhecimento, desconhecido
}

export function idsDoBalde(campanhas, balde) {
  const lista = campanhas || [];
  if (balde === 'todos' || !balde) return lista.map(c => String(c.campaign_id));
  return lista.filter(c => baldeDaCampanha(c) === balde).map(c => String(c.campaign_id));
}
