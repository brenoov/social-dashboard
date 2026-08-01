// A SEMANA: as regras de como um plano semanal se monta e se lê.
//
// POR QUE ISTO EXISTE. O robô de pauta entrega ideias AVULSAS, e distribuir as
// doze pelos dias sobrava para a pessoa. Só que um social media não pensa em
// ideias soltas — pensa em semana: o que sai segunda, quarta e sexta, com
// variedade de formato e sem dois posts de venda seguidos. Esse trabalho de
// arrumação é justamente o que a máquina faz bem.
//
// PURO: sem Vue, sem banco, sem rede. É compartilhado com o robô
// (coletor/conteudo-semana.mjs importa daqui), pelo mesmo motivo das datas
// comerciais: o robô propõe e a tela mostra — duas cópias divergiriam calado.

// ── Cadência padrão ─────────────────────────────────────────────────────────
//
// Três posts por semana, em dias alternados. Não é chute de quantidade: é o
// menor ritmo que sustenta presença sem virar um compromisso que a pessoa
// abandona na terceira semana. Quem quiser mais muda no pedido.
//
// Os horários são os de maior movimento no Instagram brasileiro — fim de
// manhã e começo de noite. Não são lei: a IA pode mudar se o histórico da
// marca disser outra coisa, e a pessoa pode arrastar depois.
export const CADENCIA_PADRAO = [
  { dia: 1, hora: '19:00' },  // segunda
  { dia: 3, hora: '12:00' },  // quarta
  { dia: 5, hora: '19:00' },  // sexta
];

export const NOMES_DOS_DIAS = [
  'domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado',
];

function _limpo(v) {
  return (typeof v === 'string' ? v : '').trim();
}

// Segunda-feira da semana que contém a data. O Instagram não liga para isso,
// mas quem planeja pensa em semana começando na segunda.
export function segundaDaSemana(data) {
  // `new Date(null)` NÃO dá data inválida: dá 1970. E `new Date(undefined)` dá
  // inválida. Testar só `isNaN` deixava passar um null como se fosse dezembro
  // de 1969, e a semana inteira nascia lá.
  if (data === null || data === undefined || data === '') return null;
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return null;
  const diaDaSemana = d.getDay();           // 0 = domingo
  const recuo = (diaDaSemana + 6) % 7;      // segunda = 0, domingo = 6
  d.setDate(d.getDate() - recuo);
  d.setHours(0, 0, 0, 0);
  return d;
}

// A PRÓXIMA semana, que é o que faz sentido planejar. Planejar a semana
// corrente com quarta-feira já em curso produz slots no passado.
export function proximaSegunda(hoje = new Date()) {
  const segunda = segundaDaSemana(hoje);
  if (!segunda) return null;
  segunda.setDate(segunda.getDate() + 7);
  return segunda;
}

function _iso(d) {
  // Data local em YYYY-MM-DD. `toISOString()` converteria para UTC e jogaria
  // a segunda-feira brasileira para domingo antes das 21h.
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Os slots vazios de uma semana: dia + hora, sem conteúdo ainda. É o esqueleto
// que vai no pedido à IA e o que a tela desenha enquanto não há proposta.
export function slotsDaSemana(segunda, cadencia = CADENCIA_PADRAO) {
  const base = segundaDaSemana(segunda);
  if (!base) return [];
  return (Array.isArray(cadencia) ? cadencia : [])
    .filter(c => Number.isInteger(c?.dia) && c.dia >= 0 && c.dia <= 6)
    .map((c) => {
      const d = new Date(base);
      // `dia` é 0=domingo..6=sábado; a semana começa na segunda (1).
      const desloca = (c.dia + 6) % 7;
      d.setDate(base.getDate() + desloca);
      return {
        data: _iso(d),
        dia_da_semana: c.dia,
        nome_do_dia: NOMES_DOS_DIAS[c.dia],
        hora: _limpo(c.hora) || '12:00',
      };
    })
    .sort((a, b) => a.data.localeCompare(b.data) || a.hora.localeCompare(b.hora));
}

// ── Leitura do que a IA devolveu ────────────────────────────────────────────

// Junta o slot proposto com a ideia que ele aponta. A IA responde com o
// ÍNDICE da ideia no banco (não o texto), porque pedir para ela repetir o
// título inteiro convida a reescrever — e aí não dá para saber se ela quis
// reaproveitar uma ideia existente ou inventar outra parecida.
export function casarSlotsComIdeias(slots, ideias) {
  const banco = Array.isArray(ideias) ? ideias : [];
  return (Array.isArray(slots) ? slots : []).map((s) => {
    // `Number(null)` é 0 — um índice VÁLIDO. Sem checar o valor cru primeiro,
    // um slot que não aponta ideia nenhuma pegava calado a primeira do banco,
    // e a semana saía com uma pauta que a IA não escolheu.
    const cru = s?.ideia_do_banco;
    const i = typeof cru === 'number' ? cru : Number.NaN;
    const doBanco = Number.isInteger(i) && i >= 0 && i < banco.length ? banco[i] : null;
    return {
      data: _limpo(s?.data),
      hora: _limpo(s?.hora) || '12:00',
      formato: _limpo(s?.formato) || _limpo(doBanco?.formato) || null,
      porque_neste_dia: _limpo(s?.porque_neste_dia) || null,
      ideia: doBanco,
      // Quando não veio do banco, a IA propôs uma pauta nova ali mesmo.
      titulo_novo: doBanco ? null : (_limpo(s?.titulo_novo) || null),
      gancho_novo: doBanco ? null : (_limpo(s?.gancho_novo) || null),
    };
  }).filter(s => s.data && (s.ideia || s.titulo_novo));
}

// O que está errado no plano, em português para quem vai olhar. Devolve lista
// vazia quando está tudo bem.
//
// ISTO NÃO É PARANOIA: a IA erra o dia com facilidade (propõe "terça" numa data
// que caiu numa quarta), e repetir a mesma ideia em dois slots é o engano mais
// comum quando ela tem um banco grande para escolher.
export function conferirPlano(slots, segunda) {
  const problemas = [];
  const lista = Array.isArray(slots) ? slots : [];
  if (!lista.length) return ['O plano voltou vazio.'];

  const base = segundaDaSemana(segunda);
  const fim = base ? new Date(base) : null;
  if (fim) fim.setDate(fim.getDate() + 6);

  const vistas = new Set();
  for (const s of lista) {
    const d = new Date(`${s.data}T12:00:00`);
    if (Number.isNaN(d.getTime())) {
      problemas.push(`Data inválida: ${s.data}`);
      continue;
    }
    if (base && (d < base || d > fim)) {
      problemas.push(`${s.data} está fora da semana planejada.`);
    }
    const chave = s.ideia?.id || s.titulo_novo;
    if (chave && vistas.has(chave)) {
      problemas.push(`A mesma pauta aparece duas vezes: "${s.ideia?.titulo || s.titulo_novo}".`);
    }
    if (chave) vistas.add(chave);
  }
  return problemas;
}

// Quantos de cada formato e de cada pilar — o que responde "essa semana está
// variada?" sem a pessoa ter de contar na mão.
export function resumoDaSemana(slots) {
  const lista = Array.isArray(slots) ? slots : [];
  const conta = (chave) => {
    const c = {};
    for (const s of lista) {
      const v = s?.[chave] || s?.ideia?.[chave];
      if (v) c[v] = (c[v] || 0) + 1;
    }
    return c;
  };
  return {
    total: lista.length,
    formatos: conta('formato'),
    pilares: conta('pilar'),
    doBanco: lista.filter(s => s.ideia).length,
    novas: lista.filter(s => !s.ideia).length,
  };
}
