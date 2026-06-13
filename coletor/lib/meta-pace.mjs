// coletor/lib/meta-pace.mjs
// Cálculo puro de ritmo de meta. Sem I/O — fácil de testar.
// metaValor: meta do mês em R$
// dailyGoals: objeto {"1":valor,...} ou null (cai pra linear)
// diaDoMes: dia corrente (1..N)  ·  diasNoMes: total de dias do mês
// realizado: faturamento real acumulado no mês até hoje (R$)
export function metaPace({ metaValor, dailyGoals, diaDoMes, diasNoMes, realizado }) {
  const meta = Number(metaValor) || 0;
  let esperadoAteHoje = 0;
  if (dailyGoals && typeof dailyGoals === 'object') {
    for (let d = 1; d <= diaDoMes; d++) esperadoAteHoje += Number(dailyGoals[String(d)]) || 0;
  } else {
    esperadoAteHoje = diasNoMes > 0 ? (meta / diasNoMes) * diaDoMes : 0;
  }
  esperadoAteHoje = Math.round(esperadoAteHoje);
  const real = Math.round(Number(realizado) || 0);
  const ritmoDiario = diaDoMes > 0 ? real / diaDoMes : 0;
  const projecaoFechamento = Math.round(ritmoDiario * diasNoMes);
  const percentMeta = meta > 0 ? Math.round((real / meta) * 100) : 0;
  const status = real >= esperadoAteHoje ? 'adiantado' : 'atrasado';
  return { metaValor: meta, esperadoAteHoje, realizado: real, status, projecaoFechamento, percentMeta };
}
