// A árvore Empresa → Local → Cômodo → bens. Lógica pura: não toca banco nem DOM.
//
// O ponto central deste módulo é NÃO PERDER BEM. No inventário real do dono há
// item sem empresa, sem unidade e sem cômodo preenchidos. Agrupar de forma
// ingênua faria esses itens desaparecerem da navegação — eles existem, valem
// dinheiro, e some do mapa justamente o que mais precisa de atenção. Por isso
// todo nível ganha um grupo "Sem ..." quando há órfão, e dá pra ENTRAR nele.
import { somarCentavos } from './patrimonio-lista.js'

// Sentinela do grupo dos órfãos. É string (e não null) porque vira valor de
// estado de navegação e de :key no v-for, onde null não serve.
export const SEM_VALOR = '__sem__'

const ROTULO_SEM = {
  empresa_id: 'Sem empresa',
  local_id: 'Sem local',
  comodo_id: 'Sem cômodo',
}

const CAMPO_DO_NIVEL = {
  empresaId: 'empresa_id',
  localId: 'local_id',
  comodoId: 'comodo_id',
}

// Junta os bens por um campo (empresa_id, local_id ou comodo_id) e devolve os
// grupos com quantidade e total. A ordem segue a lista de cadastro (que já vem
// ordenada por 'ordem'), e o grupo dos órfãos fica SEMPRE por último — é
// exceção, não pode disputar o topo com o que está em ordem.
// Grupo sem nenhum bem não aparece: lista de cadastro não é lista de navegação.
export function agruparBens(bens, campo, listaDeCadastro) {
  const lista = Array.isArray(bens) ? bens : []
  const cadastro = Array.isArray(listaDeCadastro) ? listaDeCadastro : []

  const porId = new Map()
  for (const bem of lista) {
    if (!bem) continue
    const chave = bem[campo] || SEM_VALOR
    if (!porId.has(chave)) porId.set(chave, [])
    porId.get(chave).push(bem)
  }

  const grupos = []
  for (const item of cadastro) {
    const doGrupo = porId.get(item.id)
    if (!doGrupo || !doGrupo.length) continue
    grupos.push({
      id: item.id,
      nome: item.nome,
      quantidade: doGrupo.length,
      totalCentavos: somarCentavos(doGrupo),
    })
  }

  const orfaos = porId.get(SEM_VALOR)
  if (orfaos && orfaos.length) {
    grupos.push({
      id: SEM_VALOR,
      nome: ROTULO_SEM[campo] || 'Sem classificação',
      quantidade: orfaos.length,
      totalCentavos: somarCentavos(orfaos),
    })
  }
  return grupos
}

// Os bens que estão embaixo do caminho atual. Cada trecho do caminho é opcional;
// caminho vazio = tudo. A sentinela filtra pelos órfãos daquele nível, que é o
// que torna o grupo "Sem ..." navegável de verdade e não só um rótulo.
export function bensDoCaminho(bens, caminho) {
  const lista = Array.isArray(bens) ? bens : []
  const c = caminho || {}
  return lista.filter((bem) => {
    if (!bem) return false
    for (const [nivel, campo] of Object.entries(CAMPO_DO_NIVEL)) {
      const escolhido = c[nivel]
      if (!escolhido) continue
      if (escolhido === SEM_VALOR) {
        if (bem[campo]) return false
      } else if (bem[campo] !== escolhido) {
        return false
      }
    }
    return true
  })
}

// O nome do lugar onde a pessoa está agora — o do nível MAIS FUNDO que ela
// escolheu. Vai no topo da tela para ela nunca se perder na descida.
export function rotuloDoCaminho(caminho, listas) {
  const c = caminho || {}
  const l = listas || {}
  const niveis = [
    ['comodoId', 'comodo_id', l.comodos],
    ['localId', 'local_id', l.locais],
    ['empresaId', 'empresa_id', l.empresas],
  ]
  for (const [nivel, campo, cadastro] of niveis) {
    const escolhido = c[nivel]
    if (!escolhido) continue
    if (escolhido === SEM_VALOR) return ROTULO_SEM[campo]
    const achou = (cadastro || []).find((x) => x.id === escolhido)
    return achou ? achou.nome : 'Não encontrado'
  }
  return 'Patrimônio'
}
