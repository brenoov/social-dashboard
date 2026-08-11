// QUAIS FERRAMENTAS GASTAM DINHEIRO DE VERDADE (D4 do desenho de 11/08/2026).
//
// O selo existe pra quem concede parar meio segundo antes de marcar. Ele só
// vale enquanto significar UMA coisa: **esta pessoa vai poder gastar verba**.
//
// FICOU DE FORA de propósito, e não por esquecimento:
// - `sales.metas` — meta é alvo de faturamento, não gasto. (Eu havia incluído
//   por engano no desenho; corrigido antes de virar código.)
// - `acessos` com "Tudo" (apaga colaborador) e `frota.aprovar` (libera carro)
//   são "consequência que não se desfaz", que é OUTRO critério. Misturar os
//   dois faz o selo perder força. Se o dono quiser esse segundo aviso, ele
//   ganha selo próprio — não este.
export const SELO_DINHEIRO = '💰 mexe em dinheiro'

const GASTAM = new Set([
  'meta.gestor',   // muda orçamento de campanha em veiculação
  'meta.fabrica',  // sobe campanha para a conta de anúncios
])

export function mexeEmDinheiro(recursoKey) {
  return GASTAM.has(recursoKey)
}
