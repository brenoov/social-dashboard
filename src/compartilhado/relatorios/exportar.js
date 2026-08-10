// A saída em arquivo dos relatórios. Puro no que dá pra ser puro: `matrizParaExcel`
// não toca em DOM nem em banco, e é ela que os testes cobrem. O `baixarExcel`
// só embrulha a chamada do XLSX, que é global carregado no index.html.
//
// Por que isto não mora em patrimonio/planilha-e-resumo.js: aquela versão era
// amarrada em COLUNAS_PLANILHA, e os oito relatórios têm colunas diferentes.
// Copiar a regra de "dinheiro vira número" para cada um é o caminho curto para
// duas delas discordarem.

/**
 * Cabeçalho + linhas, na ordem das colunas.
 *
 * Dinheiro sai como NÚMERO em reais (não texto) pra somar dentro do Excel —
 * exportar "R$ 8.000,00" como texto faz a planilha virar um retrato inútil.
 * E dinheiro ausente sai `null`, não `0`: zero entraria na soma e mentiria.
 */
export function matrizParaExcel(colunas, linhas) {
  const cols = (colunas || []).filter(Boolean)
  const cab = cols.map((c) => c.titulo)
  const corpo = (linhas || []).filter(Boolean).map((l) => cols.map((c) => {
    const v = l?.[c.chave]
    if (c.tipo === 'dinheiro') return typeof v === 'number' ? v / 100 : null
    if (v === null || v === undefined) return ''
    return v
  }))
  return [cab, ...corpo]
}

/**
 * O nome da aba, do jeito que o Excel aceita.
 *
 * Duas regras dele, e as duas derrubam o arquivo INTEIRO — não a aba:
 *  - nada de `: \ / ? * [ ]`;
 *  - no máximo 31 caracteres.
 *
 * A barra é a que morde de verdade: "Resumo por marca/local" é título de
 * relatório, e o botão Excel dele simplesmente não baixava nada.
 */
export function nomeDeAbaValido(titulo) {
  const limpo = String(titulo ?? '').replace(/[:\\/?*[\]]/g, '-').trim()
  return (limpo || 'Relatório').slice(0, 31)
}

/**
 * Dispara o download do .xlsx. Devolve `{ ok }` em vez de avisar sozinho:
 * quem chama é que sabe como esta ferramenta mostra recado ao usuário.
 *
 * E NUNCA estoura: exceção solta aqui vira clique que não faz nada, sem uma
 * palavra na tela. Foi assim que a barra do título passou despercebida.
 */
export function baixarExcel({ colunas, linhas, nomeAba, nomeArquivo } = {}) {
  const XLSX = typeof globalThis !== 'undefined' ? globalThis.XLSX : undefined
  if (!XLSX) return { ok: false, motivo: 'Exportador não carregou. Recarregue a página.' }
  try {
    const ws = XLSX.utils.aoa_to_sheet(matrizParaExcel(colunas, linhas))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, nomeDeAbaValido(nomeAba))
    XLSX.writeFile(wb, nomeArquivo)
    return { ok: true }
  } catch (e) {
    return { ok: false, motivo: e?.message || 'Não consegui gerar a planilha.' }
  }
}
