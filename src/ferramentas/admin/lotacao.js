// AGRUPAR AS PESSOAS POR MARCA, LOCAL OU SETOR.
//
// Uma gaveta por vez, escolhida na tela — e não três níveis encaixados: com 17
// pessoas e 14 setores, quase toda gaveta teria uma pessoa dentro.
//
// DE ONDE VEM CADA UMA (medido em 2026-08-06):
//   setor → acessos_pessoas.setor_id      → acessos_setores       (4 de 17)
//   local → acessos_pessoas.organizacao_id → acessos_organizacoes (4 de 17)
//   marca → acessos_pessoas.marca_id      → patrimonio_empresas   (0 de 17, campo novo)
//
// PURO: recebe as pessoas já montadas e não fala com banco nem com DOM.

export const DIMENSOES = [
  { chave: 'marca', rotulo: 'Marca' },
  { chave: 'local', rotulo: 'Local' },
  { chave: 'setor', rotulo: 'Setor' },
]

const rotuloDaDimensao = (chave) =>
  (DIMENSOES.find((d) => d.chave === chave) || {}).rotulo || chave

const porNome = (a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR')

export function agruparPor(pessoas, dimensao) {
  const lista = Array.isArray(pessoas) ? pessoas : []
  if (!lista.length) return []

  const conhecida = DIMENSOES.some((d) => d.chave === dimensao)

  const gavetas = new Map()
  const sem = []
  for (const p of lista) {
    // Dimensão desconhecida cai inteira em "sem": mostrar todo mundo num grupo
    // errado é melhor que sumir com a lista, porque tela vazia é lida como
    // "não há usuários".
    const valor = conhecida ? p[dimensao] : null
    if (!valor) { sem.push(p); continue }
    if (!gavetas.has(valor)) gavetas.set(valor, [])
    gavetas.get(valor).push(p)
  }

  const out = [...gavetas.entries()]
    .map(([rotulo, pes]) => ({ chave: rotulo, rotulo, quantos: pes.length, pessoas: pes.sort(porNome) }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'))

  // O grupo "sem ___" fecha a lista, mesmo sendo o maior. Ele é lembrete, não
  // assunto: hoje são 17 de 17 sem marca, e abrir a tela por ele daria a
  // impressão de que não há nada cadastrado.
  if (sem.length) {
    out.push({
      chave: '__sem__',
      rotulo: `Sem ${rotuloDaDimensao(dimensao).toLowerCase()}`,
      quantos: sem.length,
      pessoas: sem.sort(porNome),
      semLotacao: true,
    })
  }
  return out
}
