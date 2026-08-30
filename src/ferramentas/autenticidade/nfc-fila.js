// A fila de gravação das etiquetas NFC. Contas puras — sem DOM, sem rede, sem
// NDEFReader — porque é aqui que mora a decisão de marcar ou não uma peça como
// gravada, e essa decisão precisa ser testável sem abrir navegador.
import { enderecoDaTag } from './lotes.js'

// O prefixo NASCE de enderecoDaTag, nunca escrito de novo. Domínio em dois
// lugares é domínio errado esperando acontecer — e este aqui vai gravado dentro
// de um chip costurado numa bolsa, onde não se corrige.
const PREFIXO = enderecoDaTag('')

export function codigoDoEndereco(url) {
  const texto = String(url ?? '').trim()
  if (!texto.toLowerCase().startsWith(PREFIXO.toLowerCase())) return null
  // corta em barra, interrogação ou cerquilha: app de NFC de terceiros costuma
  // devolver o endereço com sobras
  const resto = texto.slice(PREFIXO.length).split(/[?#/]/)[0].toUpperCase()
  return /^[A-Z0-9]{6,32}$/.test(resto) ? resto : null
}

// É ESTA FUNÇÃO QUE DECIDE SE MARCA OU NÃO.
// 'confere'      → a etiqueta devolveu esta peça; pode marcar
// 'vazia'        → etiqueta em branco; pode gravar
// 'outra-peca'   → etiqueta JÁ TEM outra peça do selo; PARAR, não sobrescrever
// 'nao-e-vessel' → tem alguma coisa que não é do selo
export function conferirLeitura(lidoDaTag, codigoEsperado) {
  const texto = String(lidoDaTag ?? '').trim()
  if (!texto) return 'vazia'
  const codigo = codigoDoEndereco(texto)
  if (!codigo) return 'nao-e-vessel'
  return codigo === String(codigoEsperado ?? '').trim().toUpperCase()
    ? 'confere'
    : 'outra-peca'
}
