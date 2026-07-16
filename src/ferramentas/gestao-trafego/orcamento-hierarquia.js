// Decide ONDE mora o orçamento (campanha ou conjunto de anúncios) e monta a
// hierarquia campanha → conjuntos → anúncios. Puro (sem I/O, sem DOM, sem
// Supabase): recebe tudo por parâmetro e devolve dados. É o que o node:test
// consegue exercitar — a tela em si é DOM-imperativa.
//
// VOCABULÁRIO (a tela erra isso antes deste módulo existir):
//   CBO = Campaign Budget Optimization → orçamento NA CAMPANHA, o Meta
//         distribui entre os conjuntos. O conjunto NÃO aceita edição.
//   ABO = Ad Set Budget Optimization  → orçamento NO CONJUNTO, cada conjunto
//         tem o seu. A campanha NÃO aceita edição.

// Lê um orçamento da Meta (string em centavos). Ausente, vazio, não-numérico
// ou zero = sem orçamento naquele nível.
function _centavos(v) {
  if (v == null || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Orçamento de uma campanha OU de um conjunto (mesma forma na Graph API).
// → {tipo:'diario'|'total', centavos, reais} ou null se não tem orçamento próprio.
export function orcamentoDe(obj) {
  if (!obj) return null;
  const diario = _centavos(obj.daily_budget);
  if (diario != null) return { tipo: 'diario', centavos: diario, reais: diario / 100 };
  const total = _centavos(obj.lifetime_budget);
  if (total != null) return { tipo: 'total', centavos: total, reais: total / 100 };
  return null;
}

// ONDE está o orçamento desta campanha?
// Regra: campanha COM orçamento próprio = CBO. Campanha SEM orçamento próprio
// e com pelo menos um conjunto que tem o seu = ABO. Sem nenhum dos dois (ou
// sem conseguir ler os conjuntos) = indefinido — e aí não se promete edição.
export function detectarNivelOrcamento(campanha, conjuntos) {
  const daCampanha = orcamentoDe(campanha);
  if (daCampanha) {
    return {
      nivel: 'campanha',
      sigla: 'CBO',
      rotulo: 'Orçamento na campanha (CBO)',
      explicacao: 'O orçamento é da campanha e o Meta distribui entre os conjuntos. Edite no nível da campanha.',
    };
  }
  const comOrcamento = (conjuntos || []).filter((c) => orcamentoDe(c));
  if (comOrcamento.length) {
    return {
      nivel: 'conjunto',
      sigla: 'ABO',
      rotulo: 'Orçamento nos conjuntos (ABO)',
      explicacao: 'Cada conjunto de anúncios tem o próprio orçamento. Edite no nível do conjunto, não da campanha.',
    };
  }
  return {
    nivel: 'indefinido',
    sigla: null,
    rotulo: 'Orçamento não identificado',
    explicacao: 'Não consegui identificar onde fica o orçamento desta campanha. Ajuste direto no Gerenciador de Anúncios da Meta.',
  };
}

// Pode editar o orçamento DIÁRIO da campanha aqui?
// Só quando é CBO e o orçamento é diário — orçamento TOTAL (lifetime) não se
// muda pelo campo "R$/dia", então a tela não oferece (evita mandar
// daily_budget numa campanha de orçamento total e tomar erro da Meta).
export function podeEditarOrcamentoDaCampanha(campanha, conjuntos) {
  const nivel = detectarNivelOrcamento(campanha, conjuntos);
  if (nivel.nivel !== 'campanha') {
    return { editavel: false, motivo: nivel.explicacao };
  }
  const orc = orcamentoDe(campanha);
  if (orc.tipo !== 'diario') {
    return { editavel: false, motivo: 'Esta campanha usa orçamento total (não diário). Ajuste no Gerenciador de Anúncios da Meta.' };
  }
  return { editavel: true, motivo: null, atualReais: orc.reais };
}

// Pode editar o orçamento DIÁRIO deste conjunto aqui?
export function podeEditarOrcamentoDoConjunto(campanha, conjunto, conjuntos) {
  const nivel = detectarNivelOrcamento(campanha, conjuntos);
  if (nivel.nivel === 'campanha') {
    return { editavel: false, motivo: 'O orçamento está na campanha (CBO). Ajuste no nível da campanha, não do conjunto.' };
  }
  const orc = orcamentoDe(conjunto);
  if (!orc) {
    return { editavel: false, motivo: 'Este conjunto não tem orçamento próprio.' };
  }
  if (orc.tipo !== 'diario') {
    return { editavel: false, motivo: 'Este conjunto usa orçamento total (não diário). Ajuste no Gerenciador de Anúncios da Meta.' };
  }
  return { editavel: true, motivo: null, atualReais: orc.reais };
}

// Monta a hierarquia de UMA campanha: conjuntos → anúncios.
// - conjuntos: objetos da Graph (/adsets) já filtrados para esta campanha
// - anuncios: insights de anúncio desta campanha (têm adset_id/adset_name)
// Anúncio cujo conjunto não veio na lista (ex.: a busca de conjuntos falhou)
// NÃO some: vira um conjunto reconstruído do próprio insight, sem orçamento.
// Conjunto sem anúncio com gasto continua aparecendo (dá pra editar o
// orçamento dele mesmo com gasto zero) — MENOS os arquivados sem gasto
// nenhum, que são peso morto e só entulhariam a tela.
// → [{ id, nome, conjunto, anuncios, gasto }] ordenado por gasto desc.
export function montarHierarquia(conjuntos, anuncios) {
  const grupos = new Map();
  const garante = (id, nome, conjunto) => {
    if (!grupos.has(id)) grupos.set(id, { id, nome: nome || '—', conjunto: conjunto || null, anuncios: [], gasto: 0 });
    const g = grupos.get(id);
    if (conjunto && !g.conjunto) g.conjunto = conjunto;
    if (nome && (g.nome === '—' || !g.nome)) g.nome = nome;
    return g;
  };
  for (const cj of conjuntos || []) {
    if (!cj || cj.id == null) continue;
    garante(String(cj.id), cj.name, cj);
  }
  for (const ad of anuncios || []) {
    const id = ad && ad.adset_id != null ? String(ad.adset_id) : '_sem_conjunto';
    const g = garante(id, (ad && ad.adset_name) || null, null);
    g.anuncios.push(ad);
    g.gasto += parseFloat((ad && ad.spend) || 0) || 0;
  }
  const vivo = (g) => !(g.conjunto && g.conjunto.effective_status === 'ARCHIVED' && g.gasto === 0 && !g.anuncios.length);
  return [...grupos.values()].filter(vivo).sort((a, b) => b.gasto - a.gasto);
}
