// A FRASE DE UMA LINHA DA LISTA DE PESSOAS (D5 do desenho de 11/08/2026).
//
// A primeira versão deste resumo foi proposta DENTRO da ficha da pessoa,
// escondendo o detalhe — e o dono recusou: ele quer ver as 24 ferramentas.
// O resumo não estava errado, estava no lugar errado. Aqui ele responde "quem
// é essa pessoa aqui dentro" sem precisar abrir.
//
// A frase cita o que a pessoa MEXE, não o que ela lê: 7 dos recursos são
// vistos por 80-93% das pessoas (medido em 11/08/2026), então citá-los não
// diferencia ninguém.
import { mexeEmDinheiro } from './consequencia-do-recurso.js'

// Como se chama, em uma palavra, o assunto de cada ferramenta que dá poder.
const ASSUNTO = {
  'meta.gestor': 'Anúncios', 'meta.fabrica': 'Anúncios', 'meta.campanha': 'Anúncios',
  frota: 'Frota', 'frota.aprovar': 'Frota',
  patrimonio: 'Patrimônio', acessos: 'Colaboradores',
  conteudo: 'Conteúdo', 'conteudo.aprovar': 'Conteúdo',
  'sales.metas': 'Metas de venda', banco: 'Arquivos',
}

const MEXE = ['criar', 'editar', 'excluir']
const podeMexer = (acoes) => (acoes || []).some((a) => MEXE.includes(a))

// permissions -> {frase, quantos, comDinheiro}. Puro: não conhece RECURSOS,
// nem quantos existem no catálogo — isso é conta de quem exibe.
export function resumoDoAcesso(permissions) {
  const p = permissions || {}
  const chaves = Object.keys(p).filter((k) => (p[k] || []).length)
  const comDinheiro = chaves.filter(mexeEmDinheiro).length

  const assuntos = []
  for (const k of chaves) {
    if (!podeMexer(p[k])) continue
    const a = ASSUNTO[k]
    if (a && !assuntos.includes(a)) assuntos.push(a)
  }

  let frase
  if (!chaves.length) frase = 'Sem acesso a ferramenta nenhuma.'
  else if (!assuntos.length) frase = 'Só painéis de leitura.'
  else if (assuntos.length === 1) frase = assuntos[0]
  else frase = assuntos.slice(0, -1).join(', ') + ' e ' + assuntos.at(-1)

  return { frase, quantos: chaves.length, comDinheiro }
}
