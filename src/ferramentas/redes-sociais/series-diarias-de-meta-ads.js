// Monta as séries DIÁRIAS dos dois gráficos da seção "02 · Meta Ads":
//   1) investimento por dia (barras) + linha da meta diária;
//   2) custo por seguidor por dia (barras) + linha da meta máxima.
//
// Módulo PURO de propósito: recebe as linhas já lidas do banco e devolve os pontos.
// Não importa NADA (nem o cliente do Supabase) — assim o teste roda no Node limpo,
// sem esbarrar no `window.supabase` que o conectar-no-banco-de-dados.js exige.
//
// Entradas esperadas:
//   linhasDeGasto      → campaign_insights com period_days = 0 (gasto do dia isolado),
//                        uma linha POR CAMPANHA por dia: { captured_at, spend }.
//   linhasDeSeguidores → um registro por dia: { data, novos, saiu }.
//                        (é o mesmo par novos/saíram que o gráfico de seguidores usa)

const UM_DIA = 86400000;
const LIMITE_DE_DIAS = 400; // trava de sanidade: janela absurda não vira laço infinito

/** Lista todos os dias (YYYY-MM-DD) de `inicio` até `fim`, inclusive. */
export function listarDias(inicio, fim) {
  if (!inicio || !fim) return [];
  const t0 = Date.parse(inicio + 'T00:00:00Z');
  const t1 = Date.parse(fim + 'T00:00:00Z');
  if (!isFinite(t0) || !isFinite(t1) || t1 < t0) return [];
  const dias = [];
  for (let t = t0; t <= t1 && dias.length < LIMITE_DE_DIAS; t += UM_DIA) {
    dias.push(new Date(t).toISOString().slice(0, 10));
  }
  return dias;
}

/**
 * Soma o gasto de todas as campanhas de cada dia.
 * Devolve { 'YYYY-MM-DD': gastoDoDia }. Dia AUSENTE do mapa = dia sem coleta
 * (buraco de verdade), diferente de dia coletado com gasto zero.
 */
export function somarGastoPorDia(linhasDeGasto) {
  const porDia = {};
  for (const l of linhasDeGasto || []) {
    const dia = l && l.captured_at ? String(l.captured_at).slice(0, 10) : null;
    if (!dia) continue;
    const v = parseFloat(l.spend);
    porDia[dia] = (porDia[dia] || 0) + (isFinite(v) ? v : 0);
  }
  return porDia;
}

/**
 * Novos seguidores LÍQUIDOS por dia (seguiram − deixaram de seguir).
 * Mesma conta do card "CUSTO POR SEGUIDOR" (investimento ÷ novos seguidores).
 * Devolve { 'YYYY-MM-DD': liquido }.
 */
export function somarSeguidoresPorDia(linhasDeSeguidores) {
  const porDia = {};
  for (const l of linhasDeSeguidores || []) {
    const dia = l && l.data ? String(l.data).slice(0, 10) : null;
    if (!dia) continue;
    const novos = Number(l.novos) || 0;
    const saiu = Number(l.saiu) || 0;
    porDia[dia] = (porDia[dia] || 0) + (novos - saiu);
  }
  return porDia;
}

/**
 * Meta DIÁRIA de investimento = budget do período ÷ nº de dias do período.
 * O card "BUDGET" é do PERÍODO inteiro; o gráfico é por dia. Dividir é o único
 * jeito de a linha responder a pergunta "gastei demais NESTE dia?".
 */
export function metaDiariaDeInvestimento(budgetDoPeriodo, totalDeDias) {
  const b = Number(budgetDoPeriodo);
  if (!isFinite(b) || b <= 0 || !totalDeDias || totalDeDias <= 0) return 0;
  return b / totalDeDias;
}

/** Série de barras do investimento por dia + linha da meta diária. */
export function montarSerieDeInvestimento({ inicio, fim, linhasDeGasto, budgetDoPeriodo } = {}) {
  const dias = listarDias(inicio, fim);
  const gasto = somarGastoPorDia(linhasDeGasto);
  const pontos = dias.map((data) => {
    const temColeta = Object.prototype.hasOwnProperty.call(gasto, data);
    return temColeta
      ? { data, valor: gasto[data], semDado: false, motivo: null }
      : { data, valor: null, semDado: true, motivo: 'sem-coleta' };
  });
  return {
    pontos,
    meta: metaDiariaDeInvestimento(budgetDoPeriodo, dias.length),
    temDado: pontos.some((p) => !p.semDado),
    totalDeDias: dias.length,
  };
}

/**
 * Série de barras do custo por seguidor por dia + linha da meta máxima.
 * A meta NÃO é dividida por dia: "META MÁX" já é um valor por seguidor
 * (R$ por seguidor), que vale igual em qualquer recorte de tempo.
 *
 * Por dia:
 *   sem linha de gasto              → sem dado ('sem-coleta')
 *   líquido de seguidores <= 0      → sem dado ('sem-seguidor') — não divide por zero
 *                                     nem inventa custo infinito
 *   gasto 0 e seguidores > 0        → custo 0 (ganhou seguidor sem pagar)
 */
export function montarSerieDeCustoPorSeguidor({ inicio, fim, linhasDeGasto, linhasDeSeguidores, metaDeCustoPorSeguidor } = {}) {
  const dias = listarDias(inicio, fim);
  const gasto = somarGastoPorDia(linhasDeGasto);
  const seguidores = somarSeguidoresPorDia(linhasDeSeguidores);
  const pontos = dias.map((data) => {
    if (!Object.prototype.hasOwnProperty.call(gasto, data)) {
      return { data, valor: null, semDado: true, motivo: 'sem-coleta' };
    }
    const liquido = seguidores[data];
    if (!(liquido > 0)) {
      return { data, valor: null, semDado: true, motivo: 'sem-seguidor', gasto: gasto[data], seguidores: liquido == null ? null : liquido };
    }
    return { data, valor: gasto[data] / liquido, semDado: false, motivo: null, gasto: gasto[data], seguidores: liquido };
  });
  const m = Number(metaDeCustoPorSeguidor);
  return {
    pontos,
    meta: isFinite(m) && m > 0 ? m : 0,
    temDado: pontos.some((p) => !p.semDado),
    totalDeDias: dias.length,
  };
}
