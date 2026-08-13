// Lógica pura da ficha do colaborador para os blocos "Bens" e "Veículos"
// (13/08/2026, pedido do dono: "faz o link no cadastro de colaborador dos bens
// que a pessoa usa... dá pra puxar de frota também"). Antes a ficha lia
// acessos_dispositivos — tabela do módulo antigo, com ZERO linhas desde
// sempre; a caixa "Dispositivos & patrimônio" aparecia vazia pras 27 pessoas,
// sempre. Não era criar link nenhum: era apontar pra fonte de verdade, que
// hoje é patrimonio_bens e frota_veiculos.
//
// Como os outros .js desta pasta: sem banco, sem DOM, só decisão e
// transformação — testável com `node --test` sem subir a tela.

// O gêmeo de temAcessoFrota (../patrimonio/ligacao-com-frota.js) para o
// Patrimônio: mesma forma — super-admin OU a feature do módulo no perfil —
// pro bloco de Bens da ficha decidir SE MOSTRA "sem acesso" antes mesmo de
// olhar o que a consulta trouxe. Sem isso, uma lista vazia por falta de
// acesso pareceria "esta pessoa não tem bem nenhum", que é dado inventado —
// exatamente a família do R$ 0,00 que ficou 17h na tela.
//
// A RLS de patrimonio_bens é mais generosa que a de frota_veiculos: ela
// também libera quem não é `escopo_por_equipe` e o dono do próprio cadastro
// (`pode_ver_bem`), então este sinalizador pode dizer "sem acesso" pra
// alguém que o banco na verdade deixaria ver algo por essa regra extra — o
// pior caso é a tela pedir acesso a quem já teria enxergado algo, nunca o
// oposto (mostrar como "sem acesso" nunca é mostrar dado errado). Se um dia
// isto divergir de verdade da RLS, o sintoma é a tela dizer "sem acesso" e o
// Postgres devolver dado mesmo assim — nunca o contrário.
export function temAcessoPatrimonio(estado) {
  if (!estado) return false
  if (estado.is_superadmin) return true
  return Array.isArray(estado.features) && estado.features.includes('patrimonio')
}

// A pílula de situação do bem usa as classes `.ac-pill` já existentes NESTA
// ferramenta (ok/warn/bad/neutral) — não as `.pat-pill-*` do módulo
// Patrimônio, que são CSS scoped de outro componente e não chegariam aqui.
// Os quatro valores são os mesmos do CHECK de patrimonio_bens.situacao
// (ver também rotulos-do-bem.js, que já tem o rótulo em português).
const PILULA_POR_SITUACAO = {
  em_uso: 'ok',
  em_estoque: 'neutral',
  em_manutencao: 'warn',
  baixado: 'bad',
}
export function pilulaDaSituacaoDoBem(situacao) {
  return PILULA_POR_SITUACAO[situacao] || 'neutral'
}

// Agrupa uma lista (bens ou veículos) pelo pessoa_id de cada item, pra
// Auditoria montar as colunas "Bens" e "Veículos" com UMA consulta só (todas
// as pessoas de uma vez), não uma consulta por pessoa. Item sem pessoa_id
// não entra em mapa nenhum — "sem dono" não é dono de ninguém.
export function agruparPorPessoa(lista) {
  const mapa = {}
  for (const item of Array.isArray(lista) ? lista : []) {
    if (!item || !item.pessoa_id) continue
    ;(mapa[item.pessoa_id] = mapa[item.pessoa_id] || []).push(item)
  }
  return mapa
}
