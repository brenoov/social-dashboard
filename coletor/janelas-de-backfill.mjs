// A JANELA DE DATAS de cada recorte de campaign_insights.
//
// Cada recorte é gravado por um código diferente, com uma conta de datas
// diferente. O backfill tem de fazer a MESMA pergunta que quem gravou a linha
// fez — senão o número novo não bate com o gasto que já está na mesma linha, e
// duas colunas vizinhas passam a falar de períodos diferentes.
//
// Lido no código em 17/08/2026, não deduzido:
//   0            → coletarAdsDia: time_range {since: dia, until: dia}
//                  (e coletarAdsPorCampanha com dias=0 dá a MESMA janela)
//   1, 7, 14, 30 → coletarAdsPorCampanha: until = hoje, since = hoje − dias
//                  (repare: cobre N+1 dias; o backfill COPIA o jeito, não conserta)
//   99           → coletor/recuperar-curtidas-zeradas.mjs: do 1º do mês até o dia
// PURO: sem rede, sem banco.

const RECORTES_DE_N_DIAS = [1, 7, 14, 30];

// Âncora ao MEIO-DIA de propósito: assim nem horário de verão nem fuso empurram
// a data para o dia anterior/seguinte na hora de formatar. É a mesma conta do
// coletor (supabase/functions/coletar-dados/index.ts:420).
function menosDias(dia, n) {
  const d = new Date(dia + 'T12:00:00');
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('en-CA');
}

export function janelaDoRecorte(capturedAt, periodDays) {
  if (!capturedAt) return null;
  if (periodDays === 0) return { since: capturedAt, until: capturedAt };
  if (RECORTES_DE_N_DIAS.includes(periodDays)) return { since: menosDias(capturedAt, periodDays), until: capturedAt };
  if (periodDays === 99) return { since: capturedAt.slice(0, 7) + '-01', until: capturedAt };
  return null; // recorte que ninguém grava hoje: não inventa janela
}

// Uma chamada à Meta cobre TODAS as campanhas de uma conta numa janela. Então o
// alvo é conta + data + recorte, e não a linha (que é por campanha).
// Do mais antigo para o mais novo: se a Meta interromper no meio, o que sobra é o
// pedaço recente, que a própria rodada seguinte do coletor cobre.
export function alvosPendentes(linhas) {
  const vistos = new Set();
  const alvos = [];
  for (const l of (linhas || [])) {
    if (!janelaDoRecorte(l.captured_at, l.period_days)) continue;
    const chave = `${l.account_id}|${l.captured_at}|${l.period_days}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    alvos.push({ account_id: l.account_id, captured_at: l.captured_at, period_days: l.period_days });
  }
  return alvos.sort((a, b) => (a.captured_at < b.captured_at ? -1 : a.captured_at > b.captured_at ? 1 : 0));
}
