// Textos puros do TOPO da tela de Acessos (cabeçalho + faixa de KPIs).
//
// Por que um módulo separado, sem Vue nem Supabase dentro? Porque assim dá pra
// TESTAR essa lógica de montar frase com node --test, sem precisar abrir o
// navegador nem falar com o banco. A tela chama estas funções passando os
// números que ela já contou; aqui só viramos número -> frase em português.

// Recebe quantas pastas ATIVAS existem em cada provedor e devolve o detalhe
// que aparece embaixo do número "Pastas geridas", tipo:
//   "16 WorkDrive · 32 OneDrive · 1 iCloud"
//
// Regras de bom senso:
//  - Só mostra o provedor que tem pelo menos 1 pasta (não polui com "0 iCloud").
//  - A ordem é sempre a mesma: WorkDrive, OneDrive, iCloud (igual ao desenho
//    aprovado), pra a leitura ficar previsível.
//  - Se não tem pasta nenhuma, devolve uma frase honesta em vez de vazio.
export function montarDetalhePastas(contagens) {
  const c = contagens || {}
  // Cada linha é [quantidade, nome bonito]. A ordem aqui É a ordem que aparece.
  const provedores = [
    [Number(c.workdrive) || 0, 'WorkDrive'],
    [Number(c.onedrive) || 0, 'OneDrive'],
    [Number(c.icloud) || 0, 'iCloud'],
  ]
  const partes = provedores
    .filter(([qtd]) => qtd > 0)
    .map(([qtd, nome]) => `${qtd} ${nome}`)
  if (partes.length === 0) return 'nenhuma pasta ainda'
  return partes.join(' · ')
}
