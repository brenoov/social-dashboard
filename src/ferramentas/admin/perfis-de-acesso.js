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
