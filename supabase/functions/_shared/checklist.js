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

/* ── O que entra na ficha ─────────────────────────────────────────────────── */

/** Os itens ativos das cadências pedidas, na ordem que o gestor definiu. */
export function itensDaFicha(itens, cadencias) {
  const quer = new Set(cadencias || []);
  return (itens || [])
    .filter((i) => i && i.ativo !== false && quer.has(i.cadencia))
    .slice()
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}

/* ── O hodômetro ──────────────────────────────────────────────────────────── */

// Mesmo limiar de problemasDaDevolucao() em estado-do-veiculo.js: 5.000 km numa
// tacada é quase sempre dedo errado, mas viagem longa existe — por isso pede
// confirmação em vez de barrar.
const SALTO_SUSPEITO = 5000;
const km = (n) => Math.abs(n).toLocaleString('pt-BR');

/**
 * O número do painel vale? Devolve { ok, precisaJustificar, motivo }.
 *
 * `precisaJustificar` distingue as duas recusas: número em branco só se
 * corrige, mas número que contraria o histórico pode estar certo (painel
 * trocado, odômetro adulterado pelo dono anterior) e aí a pessoa explica.
 */
export function hodometroAceito(novo, ultimoConhecido) {
  if (!Number.isInteger(novo) || novo <= 0) {
    return { ok: false, precisaJustificar: false,
      motivo: 'Informe o número que está no painel agora.' };
  }
  if (!Number.isInteger(ultimoConhecido)) {
    return { ok: true, precisaJustificar: false, motivo: '' };
  }
  if (novo < ultimoConhecido) {
    return { ok: false, precisaJustificar: true,
      motivo: `O último registro deste carro era ${km(ultimoConhecido)} km, e o odômetro não `
        + 'anda para trás. Confira o número — ou explique o que aconteceu.' };
  }
  if (novo - ultimoConhecido > SALTO_SUSPEITO) {
    return { ok: false, precisaJustificar: true,
      motivo: `São ${km(novo - ultimoConhecido)} km desde o último registro. `
        + 'Confirme se está certo, ou explique.' };
  }
  return { ok: true, precisaJustificar: false, motivo: '' };
}

// Justificativa tem de ser uma frase, não um resmungo: "ok" e "sei la" não
// explicam nada pra quem for ler isso daqui a seis meses.
const JUSTIFICATIVA_MINIMA = 10;

/**
 * Valida a ficha ANTES de gravar. Lista vazia significa que pode gravar.
 * `respostas` é { [itemId]: 'ok' | 'nao_ok' | 'na' }.
 */
export function problemasDaFicha({ hodometro, ultimoKm, justificativa, respostas, itens }) {
  const p = [];
  const h = hodometroAceito(hodometro, ultimoKm);
  const explicou = String(justificativa || '').trim().length >= JUSTIFICATIVA_MINIMA;
  if (!h.ok && !(h.precisaJustificar && explicou)) p.push(h.motivo);

  const r = respostas || {};
  const faltando = (itens || []).filter((i) => !r[i.id]);
  if (faltando.length === 1) p.push(`Falta responder "${faltando[0].item}".`);
  else if (faltando.length > 1) p.push(`Faltam ${faltando.length} itens sem resposta.`);
  return p;
}

/* ── A cobrança (D16) ─────────────────────────────────────────────────────── */

/**
 * Quem fez e quem não fez o checklist hoje.
 *
 * Só entra carro COM DONO FIXO e ativo: carro de rodízio não tem de quem
 * cobrar (a ficha dele acontece quando alguém pega), e cobrar dele acusaria
 * todo dia um carro que ninguém usou — o quadro viraria ruído e ninguém
 * olharia mais.
 */
export function quemFaltaHoje({ veiculos, fichasDeHoje, pessoas }) {
  const comFicha = new Set((fichasDeHoje || []).map((f) => f && f.veiculo_id));
  return (veiculos || [])
    .filter((v) => v && v.pessoa_id && v.situacao === 'ativo')
    .map((v) => {
      const dono = (pessoas || []).find((p) => p && p.id === v.pessoa_id);
      return { veiculo: v, donoId: v.pessoa_id, dono: dono ? dono.nome : null,
        fez: comFicha.has(v.id) };
    })
    .sort((a, b) => (a.fez === b.fez
      ? String(a.veiculo.nome || '').localeCompare(String(b.veiculo.nome || ''))
      : (a.fez ? 1 : -1)));
}

/** A frase do topo do quadro. Nunca diz "tudo certo" sobre o que não sabe. */
export function resumoDaCobranca(linhas) {
  const l = linhas || [];
  if (!l.length) return 'Nenhum carro com dono fixo cadastrado.';
  const faltam = l.filter((x) => !x.fez).length;
  if (!faltam) return 'Todos os carros com dono já foram conferidos hoje.';
  return faltam === 1
    ? '1 carro ainda sem checklist hoje.'
    : `${faltam} carros ainda sem checklist hoje.`;
}
