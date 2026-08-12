// src/ferramentas/admin/perfis-de-acesso.js
//
// A SOBREPOSIÇÃO PERFIL × EXCEÇÃO (D9 do desenho de 11/08/2026).
//
// O perfil manda no que ELE cobre; o que foi dado à mão àquela pessoa fica por
// cima e sobrevive. Perfil que apaga o que alguém concedeu de propósito faz o
// dono perder trabalho sem aviso — foi a primeira coisa que ele decidiu quando
// escolheu o perfil vivo.
//
// PURO: sem rede, sem DOM. Quem chama busca perfil e pessoa e passa para cá.

// Duas listas de ação são o mesmo acesso mesmo em ordem diferente. Comparar sem
// ordenar criaria exceção fantasma para metade das pessoas, e cada exceção
// fantasma é uma ferramenta que o perfil deixa de governar.
const mesmasAcoes = (a, b) => {
  const x = [...(a || [])].sort()
  const y = [...(b || [])].sort()
  return x.length === y.length && x.every((v, i) => v === y[i])
}

// Lista vazia é "sem acesso", não uma chave concedida. Guardá-la faria a pessoa
// aparecer com uma ferramenta a mais na contagem, sem poder nenhum.
const temAcesso = (acoes) => Array.isArray(acoes) && acoes.length > 0

/** O que gravar em `profiles.permissions` para quem está neste perfil. */
export function acessoEfetivo(perfilPermissions, excecao) {
  const out = {}
  for (const [k, v] of Object.entries(perfilPermissions || {})) {
    if (temAcesso(v)) out[k] = [...v]
  }
  for (const [k, v] of Object.entries(excecao || {})) {
    if (temAcesso(v)) out[k] = [...v]
    else delete out[k]
  }
  return out
}

/**
 * O que, no acesso de hoje desta pessoa, NÃO veio do perfil.
 * Usado ao pôr alguém num perfil: o que ela já tinha e o perfil não dá vira
 * exceção, em vez de ser perdido em silêncio.
 */
export function excecaoDe(perfilPermissions, permissionsAtuais) {
  const perfil = perfilPermissions || {}
  const out = {}
  for (const [k, v] of Object.entries(permissionsAtuais || {})) {
    if (!temAcesso(v)) continue
    if (!mesmasAcoes(perfil[k], v)) out[k] = [...v]
  }
  return out
}

/**
 * Quem muda de acesso se este perfil virar `perfilNovo`, e o que muda para cada.
 *
 * D11: nada de perfil é gravado sem a tela nomear estas pessoas. É o passo que
 * mantém o dono como quem decide, em vez de descobrir depois — e a única
 * proteção que o perfil vivo tem contra dar acesso em massa em silêncio.
 *
 * Quem NÃO muda fica de fora de propósito: lista com gente que não muda vira
 * ruído, e quem lê ruído aprova sem ler.
 */
export function impactoDaMudanca(perfilNovo, membros) {
  const afetados = []
  for (const m of membros || []) {
    const antes = m.permissions || {}
    const excecao = m.permissions_excecao || {}
    const depois = acessoEfetivo(perfilNovo, excecao)
    const chaves = new Set([...Object.keys(antes), ...Object.keys(depois)])
    const ganha = []
    const perde = []
    for (const k of chaves) {
      // Chave coberta por exceção NUNCA é diferença de perfil: por D9 ela
      // sobrevive a qualquer mudança do perfil, então comparar `antes` (sem a
      // exceção) contra `depois` (com a exceção) inventaria ganho ou perda
      // numa chave que, na prática, nunca muda para essa pessoa.
      if (Object.prototype.hasOwnProperty.call(excecao, k)) continue
      const a = antes[k]
      const d = depois[k]
      if (mesmasAcoes(a, d)) continue
      if (temAcesso(d)) ganha.push(k)
      else perde.push(k)
    }
    if (ganha.length || perde.length) {
      afetados.push({ nome: m.nome, ganha: ganha.sort(), perde: perde.sort() })
    }
  }
  return { afetados, total: afetados.length }
}
