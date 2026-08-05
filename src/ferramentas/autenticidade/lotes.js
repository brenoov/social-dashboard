// Regras puras do painel de Autenticidade. Sem DOM, sem rede — por isso dá pra
// testar de verdade, sem abrir navegador.

// O endereço do domínio novo, não o do painel: é ISTO que vai gravado dentro da
// etiqueta NFC e é o que a cliente vai ver quando encostar o celular.
const DOMINIO = 'https://vesselbrasil.com.br'

export function enderecoDaTag(codigo) {
  return `${DOMINIO}/verify/${String(codigo || '').trim().toUpperCase()}`
}

export function progressoDoLote(pecas) {
  const lista = Array.isArray(pecas) ? pecas : []
  const gravadas = lista.filter((p) => p.gravada_em).length
  return { gravadas, total: lista.length, texto: `${gravadas} de ${lista.length}` }
}

// A próxima etiqueta a gravar é a primeira SEM gravação, na ordem da série. O
// banco não devolve ordenado sozinho, então a ordem se garante aqui.
export function proximaPorGravar(pecas) {
  const lista = (Array.isArray(pecas) ? pecas : [])
    .filter((p) => !p.gravada_em)
    .sort((a, b) => (a.numero_na_serie || 0) - (b.numero_na_serie || 0))
  return lista[0] || null
}

const COLUNAS = [
  ['codigo', 'codigo'],
  ['nome', 'nome'],
  ['whatsapp', 'whatsapp'],
  ['onde_comprou', 'onde comprou'],
  ['comprado_em', 'comprado em'],
  ['garantia_ate', 'garantia ate'],
]

// Excel em português abre CSV separado por PONTO-E-VÍRGULA. Com vírgula, a
// planilha inteira cai numa coluna só.
function celula(valor) {
  const texto = valor == null ? '' : String(valor)
  if (!/[;"\n]/.test(texto)) return texto
  return `"${texto.replace(/"/g, '""')}"`
}

export function linhasDoCsv(registros) {
  const cabecalho = COLUNAS.map(([, rotulo]) => rotulo).join(';')
  const linhas = (Array.isArray(registros) ? registros : [])
    .map((r) => COLUNAS.map(([campo]) => celula(r[campo])).join(';'))
  return [cabecalho, ...linhas].join('\n')
}

export function resumoDeAlertas(alertas) {
  const repetidas = alertas?.repetidas?.length || 0
  const invalidas = alertas?.invalidas?.length || 0
  return { repetidas, invalidas, limpo: repetidas === 0 && invalidas === 0 }
}
