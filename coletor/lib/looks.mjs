// SP-5A: funções puras de curadoria de looks (metadata em fabrica_looks; render em templates.mjs).
export function sincronizarLooks(registryEntries, existentes) {
  const has = new Set((existentes || []).map((e) => e.chave));
  return (registryEntries || [])
    .filter((r) => !has.has(r.chave))
    .map((r) => ({ chave: r.chave, nome: r.nome, arquetipo: r.arquetipo, objetivos: r.objetivos || [], tipo: 'codigo', ativo: true, ordem: 0 }));
}

export function looksAtivosOrdenados(fabricaLooks, objetivo) {
  return (fabricaLooks || [])
    .filter((l) => l.ativo !== false)
    .filter((l) => !objetivo || !(l.objetivos && l.objetivos.length) || l.objetivos.includes(objetivo))
    .slice()
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
    .map((l) => l.chave);
}
