/* O CHECKLIST DE PRIMEIRO ESCALÃO — o que o dia de hoje pede.
 *
 * Fonte: checklist_manutencao_primeiro_escalao.pdf, 21 itens numa lista só,
 * "antes de cada utilização". Aqui eles se repartem em diário, semanal e
 * mensal, porque um checklist de 21 itens toda manhã produz, em duas semanas,
 * alguém marcando tudo OK sem olhar — e checklist que mente é pior do que
 * checklist nenhum.
 *
 * TUDO EM UTC. As datas são texto 'YYYY-MM-DD'. Usar o fuso da máquina faria a
 * data virar no horário errado e a conferência de sexta cair no sábado.
 *
 * Mora no _shared (não em src/) porque a Edge Function do robô da manhã (uma
 * tarefa futura) roda em Deno e não alcança src/ — só o front alcança o
 * _shared. Um arquivo, dois consumidores, pra não haver duas verdades sobre
 * que dia pede o quê. */

export const CADENCIAS = ['diario', 'semanal', 'mensal'];

const num = (iso, de, ate) => Number(String(iso).slice(de, ate));
const utc = (iso) => Date.UTC(num(iso, 0, 4), num(iso, 5, 7) - 1, num(iso, 8, 10));

/** 1 = segunda … 7 = domingo. */
export function diaDaSemana(iso) {
  const n = new Date(utc(iso)).getUTCDay(); // 0 = domingo
  return n === 0 ? 7 : n;
}

/** Quantos dias de `a` até `b`. Negativo se `b` for antes. */
export function diasEntre(a, b) {
  return Math.round((utc(b) - utc(a)) / 86400000);
}

/** É o dia em que o mensal cai? Ex.: a 1ª quarta-feira do mês. */
export function ehDiaDoMensal(iso, config) {
  if (diaDaSemana(iso) !== config.dia_mensal) return false;
  // Qual ocorrência daquele dia da semana este é: dia 1 a 7 é a 1ª, 8 a 14 a 2ª.
  const ocorrencia = Math.floor((num(iso, 8, 10) - 1) / 7) + 1;
  return ocorrencia === config.semana_mensal;
}

/* NUNCA FEITO NÃO É ATRASADO. Se fosse, o primeiro dia da funcionalidade
 * jogaria os 21 itens na cara de todo mundo — exatamente o dia pesado que o
 * dono não quis. Sem histórico, espera o dia próprio chegar. */
export function semanalAtrasado(hoje, ultimaSemanal) {
  return !!ultimaSemanal && diasEntre(ultimaSemanal, hoje) > 7;
}
export function mensalAtrasado(hoje, ultimaMensal) {
  return !!ultimaMensal && diasEntre(ultimaMensal, hoje) > 31;
}

/**
 * Quais cadências a ficha de hoje pede.
 * Fim de semana devolve vazio. Dia útil sempre tem o diário; semanal e mensal
 * entram no dia próprio (D11) ou quando estão atrasados — e entram UMA vez,
 * nunca duas: semana pulada vira uma conferência, não duas.
 */
export function cadenciasDoDia({ hoje, config, ultimaSemanal, ultimaMensal }) {
  if (diaDaSemana(hoje) > 5) return [];
  const c = ['diario'];
  if (diaDaSemana(hoje) === config.dia_semanal || semanalAtrasado(hoje, ultimaSemanal)) {
    c.push('semanal');
  }
  if (ehDiaDoMensal(hoje, config) || mensalAtrasado(hoje, ultimaMensal)) {
    c.push('mensal');
  }
  return c;
}
