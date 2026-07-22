// Lógica PURA do formulário de orçamento (sem Vue) — testável em node.
// form = { modo:'ABO'|'CBO', tipo:'diario'|'total', valorReais:string, inicio:'YYYY-MM-DD', fim:'YYYY-MM-DD' }
const MIN_CENTAVOS = 500; // R$ 5,00

export function orcamentoBase() {
  return { modo: 'ABO', tipo: 'diario', valorReais: '50,00', inicio: '', fim: '' };
}

export function reaisParaCentavos(str) {
  if (typeof str !== 'string' || !str.trim()) return null;
  // remove separador de milhar '.', troca vírgula decimal por '.'
  const limpo = str.trim().replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return null;
  return Math.round(parseFloat(limpo) * 100);
}

export function validarOrcamento(form) {
  const c = reaisParaCentavos(form.valorReais);
  if (c == null) return { ok: false, erro: 'Digite um valor válido em R$.' };
  if (c < MIN_CENTAVOS) return { ok: false, erro: 'Valor mínimo é R$ 5,00.' };
  if (form.tipo === 'total') {
    if (!form.inicio || !form.fim) return { ok: false, erro: 'Preencha data de início e fim.' };
    if (form.fim <= form.inicio) return { ok: false, erro: 'A data de fim deve ser depois do início.' };
  }
  return { ok: true };
}

export function orcamentoParaEnvio(form) {
  const valor = reaisParaCentavos(form.valorReais);
  const out = { modo: form.modo === 'CBO' ? 'CBO' : 'ABO', tipo: form.tipo === 'total' ? 'total' : 'diario', valor };
  if (out.tipo === 'total') {
    out.inicio = `${form.inicio}T00:00:00-03:00`;
    out.fim = `${form.fim}T23:59:59-03:00`;
  }
  return out;
}
