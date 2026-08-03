// Como cada situação do bem aparece na tela, e quem está com ele.
// Lógica pura: não toca banco nem DOM.

// Os quatro valores são os mesmos do CHECK de patrimonio_bens.situacao
// (db/migrations/acessos/019_patrimonio_bens.sql). Mudar aqui exige mudar lá.
export const SITUACOES = [
  { valor: 'em_uso', rotulo: 'Em uso', classe: 'pat-pill-uso' },
  { valor: 'em_estoque', rotulo: 'Em estoque', classe: 'pat-pill-estoque' },
  { valor: 'em_manutencao', rotulo: 'Em manutenção', classe: 'pat-pill-manutencao' },
  { valor: 'baixado', rotulo: 'Baixado', classe: 'pat-pill-baixado' },
]

// Situação que não conhecemos devolve o próprio valor em vez de sumir: se um dia
// alguém inserir um valor novo direto no banco, a tela mostra o que é, não um vazio.
export function rotuloDaSituacao(valor) {
  if (!valor) return '—'
  const achou = SITUACOES.find((s) => s.valor === valor)
  return achou ? achou.rotulo : String(valor)
}

export function classeDaSituacao(valor) {
  const achou = SITUACOES.find((s) => s.valor === valor)
  return achou ? achou.classe : 'pat-pill-neutro'
}

// Quem está com o bem, nos três casos que o dado real produz:
//  1. colaborador cadastrado  -> o nome do cadastro (fonte de verdade)
//  2. só um nome solto        -> o nome, marcado como não cadastrado (vem da
//     importação da planilha, onde 10 nomes não existem no cadastro)
//  3. ninguém                 -> "Sem dono" (o caso mais comum: 88% dos bens)
export function textoDoDono(bem, pessoasById) {
  const b = bem || {}
  const mapa = pessoasById || {}
  if (b.pessoa_id) {
    const p = mapa[b.pessoa_id]
    return (p && p.nome) || 'Pessoa removida'
  }
  const solto = (b.dono_texto || '').trim()
  if (solto) return `${solto} (não cadastrada)`
  return 'Sem dono'
}

// Um bem "em uso" sem ninguém é incoerente — é a única combinação que a tela
// impede. As outras três situações existem justamente para bem sem dono.
export function precisaDeDono(situacao) {
  return situacao === 'em_uso'
}
