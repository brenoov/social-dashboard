// Soma do gasto de uma resposta act_X/insights com level=campaign.
//
// Existe porque o cartão de investimento do painel passou a obedecer ao balde: ele
// vinha de level=account (a conta inteira, sem filtro nenhum) enquanto os cartões
// de custo já usavam o coletado COM filtro. Na Vessel isso divergia de verdade —
// o painel mostrava R$ 7.802 e dividia R$ 461,52.
// PURO: sem rede.

export function somarGasto(resposta, ids) {
  const linhas = (resposta && Array.isArray(resposta.data)) ? resposta.data : [];
  const querTodas = !ids || ids.length === 0;
  const alvo = querTodas ? null : new Set((ids || []).map(String));
  let total = 0;
  for (const l of linhas) {
    if (alvo && !alvo.has(String(l && l.campaign_id))) continue;
    const v = parseFloat((l && l.spend) ?? '0');
    if (isFinite(v)) total += v;
  }
  return total;
}
